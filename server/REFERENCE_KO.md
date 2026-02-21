# ProofRoute AI Server Reference (Korean)

English version: `server/REFERENCE.md`

## 개요

ProofRoute AI 서버는 x402 결제 검증과 AI 프록시 실행을 담당하는 Express + TypeScript 게이트웨이입니다.

핵심 역할:

- `POST /request/:provider_id` 요청에 대한 x402 결제 검증/정산
- 라우팅 추천 (`POST /route`)
- 사용량 수집 및 ZK proof 입력 생성 (`/proof/*`)
- 정산 tx hash와 사용량 기록 바인딩 (`onAfterSettle`)

기본 체인 프로필은 `NETWORK=eip155:84532` (Base Sepolia)입니다.

## 기술 스택

- Runtime: Node.js 20+
- Framework: Express.js
- Language: TypeScript
- Validation: Zod
- Payment: `@x402/express`, `@x402/evm`, `@x402/core`
- Providers: Anthropic, OpenAI, DeepSeek, Gemini
- ZK utilities: snarkjs + circom artifacts (proof generation 경로)

## 프로바이더 카탈로그

프로바이더 맵은 `server/src/utils/pricing.ts` 기본값 + `server/data/providers.json` override로 관리됩니다.

- 총 8개 provider id (`budget/standard/premium`)
- `x402_price`, `capabilities`, `scores(speed/quality)` 포함
- 서버 시작 시 `loadProviderOverrides()`로 파일 내용을 메모리에 로드

주의:

- `/providers` `PUT`으로 카탈로그를 바꿔도 x402 routeConfig는 초기화 시점 기준이므로, 결제 규칙을 정확히 반영하려면 재시작이 안전합니다.

## 환경 변수

`server/.env.example` 기준:

```env
# Server
PORT=3001
NODE_ENV=development

# x402 Payment
RESOURCE_WALLET_ADDRESS=0xYourWalletOnBaseSepolia
FACILITATOR_URL=https://x402.org/facilitator
NETWORK=eip155:84532

# AI Provider API Keys
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
GEMINI_API_KEY=

# Optional: headless autonomous demo
HEADLESS_PRIVATE_KEY=
HEADLESS_PROVIDER=haiku
HEADLESS_GATEWAY_URL=http://localhost:3001
HEADLESS_MESSAGE=Explain what x402 is in one sentence.
```

## API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/health` | 서버 및 provider adapter 상태 |
| `GET` | `/providers` | provider 목록/가격/capability |
| `PUT` | `/providers` | provider 맵 교체 + 파일 저장 |
| `POST` | `/estimate` | 토큰 추정 기반 비용 계산 |
| `POST` | `/route` | 메타데이터 기반 provider 추천 |
| `POST` | `/request/:provider_id` | 실제 AI 실행(결제 경로) |
| `POST` | `/proof/generate` | usage batch로 proof/calldata 생성 |
| `GET` | `/proof/records` | 현재 usage batch 조회 |
| `GET` | `/usage` | 서버 usage + txHash 조회 |

## 요청/응답 스키마 핵심

### POST `/estimate`

Request:

```json
{
  "provider_id": "haiku",
  "token_estimate": 1000
}
```

Response:

```json
{
  "provider_id": "haiku",
  "estimated_cost_usd": 0.003,
  "breakdown": {
    "input_cost": 0.001,
    "output_cost": 0.002,
    "total": 0.003
  },
  "tier": "budget",
  "x402_price": "$0.001"
}
```

### POST `/route`

Request:

```json
{
  "routing_metadata": {
    "context_length": 800,
    "domain": "code",
    "tier": "budget",
    "speed_quality_weight": 20,
    "requires_thinking": false,
    "requires_web_search": false
  }
}
```

Response:

```json
{
  "recommended_provider": "haiku",
  "provider_name": "Claude Haiku 4.5",
  "x402_price": "$0.001",
  "endpoint": "/request/haiku",
  "reasoning": "Selected ...",
  "candidates": []
}
```

### POST `/request/:provider_id`

Request:

```json
{
  "messages": [
    { "role": "user", "content": "masked prompt" }
  ],
  "options": {
    "max_tokens": 512,
    "extended_thinking": false,
    "requires_web_search": false
  }
}
```

Response:

```json
{
  "provider_id": "haiku",
  "response": {
    "content": "answer",
    "model": "claude-haiku-4-5-20251001",
    "usage": {
      "input_tokens": 120,
      "output_tokens": 220
    }
  },
  "cost": {
    "input_cost": 0.00012,
    "output_cost": 0.0011,
    "actual_total": 0.00122,
    "charged": 0.001
  },
  "limits": {
    "tier": "budget",
    "max_output_tokens": 512,
    "requested_max_tokens": 512,
    "applied_max_tokens": 512
  }
}
```

### POST `/proof/generate`

Request:

```json
{
  "budgetLimit": 0.1
}
```

Behavior:

- 서버가 내부 usage batch(최대 32개)를 읽어 proof 생성
- `txHashes`를 클라이언트에서 받지 않음
- `onAfterSettle`로 수집된 `txHash`를 사용해 `txHashesRoot` 계산

## 라우팅 로직 (select-provider)

`server/src/routing/select-provider.ts` 기준:

1. tier 필터
2. capability 필터(thinking/web_search/context)
3. 조건 불충족 시 상위 tier로 escalation
4. 점수 계산: `speed*(1-w) + quality*w`, `w=speed_quality_weight/100`
5. domain match bonus `+15`
6. 최고 점수 provider 반환

최종 후보가 없으면 `claude_sonnet` fallback을 반환합니다.

## x402 결제 및 txHash 바인딩

`server/src/middleware/x402.ts`:

- provider별 `POST /request/{id}`에 결제 규칙 등록
- `x402ResourceServer.onAfterSettle`에서 settlement tx hash 수집
- `usageCollector.patchLastTxHash(txHash)`로 최신 usage record에 주입

주의:

- x402 초기화 실패 시 서버는 경고 후 결제 검증 없는 dev 모드로 동작할 수 있습니다.

## ZK usage 경로

관련 파일:

- `src/zk/usage-collector.ts`
- `src/zk/proof-generator.ts`
- `src/routes/proof.ts`
- `src/routes/usage.ts`

요약:

- usage records는 `server/data/usage-records.json`에 저장
- batch 크기는 32 (회로 제약과 동일)
- proof 생성 성공 시 처리된 batch를 큐에서 제거

## Headless Autonomous Demo

수동 wallet 클릭 없이 결제 흐름을 재현:

```bash
cd server
tsx scripts/headless-demo.ts
```

필수:

- `HEADLESS_PRIVATE_KEY`에 Base Sepolia USDC 보유 지갑 키 설정

## 디렉터리 구조

```text
server/
  src/
    config/
    middleware/
    providers/
    routes/
    routing/
    utils/
    zk/
  data/
  scripts/
```

## 개발 명령

```bash
# dev server
npm run dev

# type build
npm run build

# tests
npm test
```
