# AI Router 서버 - 한글 레퍼런스

## 프로젝트 개요

**Privacy-First AI Gateway** (ETHDenver 2026)

x402 USDC 마이크로페이먼트를 통한 AI 프록시 서버. 클라이언트(PyWebView + React)가 로컬에서 PII 마스킹 + 도메인 분류 후 이 서버로 전송. 서버는 "Dumb Pipe" — 결제 확인 + AI 프록시만 수행. 원본 데이터를 절대 보지 않음.

## 기술 스택

- **런타임**: Node.js 20+
- **언어**: TypeScript
- **프레임워크**: Express.js
- **결제**: x402 프로토콜 (@x402/express, @x402/evm, @x402/core) — Base Sepolia USDC
- **AI SDK**: @anthropic-ai/sdk, openai, @google/generative-ai
- **검증**: Zod

## 프로바이더 8개 (3티어)

| ID | 모델명 | 모델 ID | 티어 | x402 가격 | 제공사 |
|---|---|---|------|----------|--------|
| haiku | Claude Haiku 4.5 | claude-haiku-4-5-20251001 | budget | $0.001 | Anthropic |
| deepseek_v3 | DeepSeek V3.2 | deepseek-chat | budget | $0.001 | DeepSeek |
| gemini_flash | Gemini 3 Flash | gemini-3-flash-preview | budget | $0.001 | Google |
| claude_sonnet | Claude Sonnet 4.5 | claude-sonnet-4-5-20250929 | standard | $0.01 | Anthropic |
| gpt5 | GPT-5.2 | gpt-5.2 | standard | $0.01 | OpenAI |
| gemini_pro | Gemini 3 Pro | gemini-3-pro-preview | standard | $0.01 | Google |
| deepseek_r1 | DeepSeek R1 | deepseek-reasoner | premium | $0.02 | DeepSeek |
| claude_opus | Claude Opus 4.5 | claude-opus-4-5-20251101 | premium | $0.03 | Anthropic |

## 엔드포인트

| 메서드 | 엔드포인트 | 인증 | 설명 |
|--------|----------|------|------|
| GET | /health | 없음 | 서버 + 프로바이더 상태 체크 |
| GET | /providers | 없음 | 8개 프로바이더 정보 (가격, 능력) |
| POST | /estimate | 없음 | 토큰 기반 비용 추정 |
| POST | /route | 없음 | 메타데이터 기반 최적 프로바이더 추천 |
| POST | /request/:provider_id | x402 | AI 요청 프록시 |

## 엔드포인트 상세

### GET /health

서버와 모든 프로바이더 상태 확인.

응답:
```json
{
  "status": "ok",
  "timestamp": "2025-02-11T10:30:00Z",
  "providers": {
    "anthropic": true,
    "openai": true,
    "deepseek": true,
    "gemini": true
  }
}
```

### GET /providers

전체 프로바이더 목록, 가격, 능력 정보.

응답 예시:
```json
{
  "providers": [
    {
      "id": "gemini_flash",
      "model": "gemini-3-flash-preview",
      "name": "Gemini 3 Flash",
      "tier": "budget",
      "x402_price": "$0.001",
      "pricing": {
        "input_per_1k_tokens": 0.0001,
        "output_per_1k_tokens": 0.0004
      },
      "capabilities": {
        "domains": ["code", "analysis", "writing"],
        "extended_thinking": false,
        "web_search": true,
        "max_context": 1000000
      }
    }
  ]
}
```

### POST /estimate

토큰 추정값을 기반으로 비용 계산.

요청:
```json
{
  "provider_id": "gemini_flash",
  "input_tokens": 500,
  "output_tokens": 1000
}
```

응답:
```json
{
  "provider_id": "gemini_flash",
  "input_cost": 0.00005,
  "output_cost": 0.0004,
  "total_cost": 0.00045,
  "x402_charge": 0.001
}
```

### POST /route

클라이언트의 메타데이터로 최적 프로바이더 추천. 로컬 AI가 분류한 도메인, 우선순위, 요구사항 기반.

요청:
```json
{
  "routing_metadata": {
    "context_length": 500,
    "domain": "code",
    "priority": "speed",
    "requires_thinking": false,
    "requires_web_search": false
  }
}
```

도메인 값:
- `code` - 코드 작성/분석
- `analysis` - 데이터/문서 분석
- `writing` - 텍스트 생성
- `math` - 수학 계산
- `reasoning` - 논리적 추론
- `simple_qa` - 간단한 질답
- `general` - 기타

우선순위:
- `speed` - 빠른 응답 (budget 티어 선호)
- `quality` - 높은 정확도 (standard/premium 티어 선호)
- `cost` - 최저 비용 (x402 가격 + 토큰 비용 최소화)

응답:
```json
{
  "recommended_provider": "gemini_flash",
  "provider_name": "Gemini 3 Flash",
  "x402_price": "$0.001",
  "endpoint": "/request/gemini_flash",
  "reasoning": "Selected Gemini 3 Flash: budget tier for speed, supports code domain"
}
```

### POST /request/:provider_id

선택한 프로바이더로 AI 요청 전송. x402 결제 미들웨어로 보호됨.

요청:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "마스킹된 쿼리..."
    }
  ],
  "options": {
    "max_tokens": 4096,
    "extended_thinking": false,
    "thinking_budget": 10000
  }
}
```

응답:
```json
{
  "provider_id": "gemini_flash",
  "response": {
    "content": "응답 텍스트...",
    "model": "gemini-3-flash-preview",
    "usage": {
      "input_tokens": 150,
      "output_tokens": 320
    }
  },
  "cost": {
    "input_cost": 0.000015,
    "output_cost": 0.000128,
    "actual_total": 0.000143,
    "charged": 0.001
  }
}
```

오류 응답:
```json
{
  "error": "Provider request timed out",
  "provider": "gemini_flash"
}
```

HTTP 상태 코드:
- 400: 알 수 없는 프로바이더
- 429: 비율 제한 초과
- 502: 프로바이더 인증 실패
- 503: 프로바이더 일시 불가
- 504: 프로바이더 요청 타임아웃
- 500: 기타 오류

## 프로젝트 구조

```
server/src/
├── index.ts                      # Express 진입점
├── config/
│   └── env.ts                    # Zod 환경변수 검증
├── providers/
│   ├── types.ts                  # AIRequest, AIResponse, ProviderAdapter
│   ├── registry.ts               # 4개 어댑터 등록 + 요청 실행
│   ├── anthropic.ts              # Claude (thinking 지원)
│   ├── openai.ts                 # GPT-5.2
│   ├── deepseek.ts               # DeepSeek (OpenAI SDK + baseURL)
│   └── gemini.ts                 # Gemini
├── routes/
│   ├── providers.ts              # GET /providers
│   ├── estimate.ts               # POST /estimate
│   ├── request.ts                # POST /request/:provider_id
│   └── route.ts                  # POST /route (라우팅 엔진)
├── middleware/
│   ├── x402.ts                   # x402 결제 미들웨어
│   └── validation.ts             # Zod 스키마 검증
└── utils/
    ├── pricing.ts                # PROVIDERS 맵, 비용 계산
    └── logger.ts                 # 구조화 로깅
```

## 환경변수 (.env)

필수:
```
PORT=3001
NODE_ENV=development
RESOURCE_WALLET_ADDRESS=0x...          # Base Sepolia 지갑 주소
FACILITATOR_URL=https://x402.org/facilitator
NETWORK=eip155:84532                   # Base Sepolia
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

## 프로바이더별 SDK 차이점

| 항목 | Anthropic | OpenAI | DeepSeek | Gemini |
|------|-----------|--------|----------|--------|
| SDK | @anthropic-ai/sdk | openai | openai (baseURL 변경) | @google/generative-ai |
| 입력 토큰 | `usage.input_tokens` | `usage.prompt_tokens` | `usage.prompt_tokens` | `usageMetadata.promptTokenCount` |
| 출력 토큰 | `usage.output_tokens` | `usage.completion_tokens` | `usage.completion_tokens` | `usageMetadata.candidatesTokenCount` |
| 컨텐츠 접근 | `content[].text` | `choices[0].message.content` | `choices[0].message.content` | `response.text()` |
| Extended Thinking | 지원 (Opus) | 미지원 | reasoning_content로 지원 | 미지원 |
| Web Search | 미지원 | 지원 | 미지원 | 지원 |
| 타임아웃 | 30s / 120s (thinking) | 30s | 30s / 120s (reasoner) | 30s |

## 라우팅 엔진 로직 (POST /route)

1. **능력 필터링**: 메타데이터 요구사항으로 프로바이더 필터
   - thinking 필요 → extended_thinking 지원하는 프로바이더만
   - web_search 필요 → web_search 지원하는 프로바이더만
   - context_length 확인 → max_context 초과하는 프로바이더 제외

2. **우선순위별 스코링**:
   - **speed**: budget 티어 +100점, standard +50점. haiku +20, gemini_flash +15
   - **quality**: premium +100점, standard +80점. extended_thinking +20
   - **cost**: x402 가격과 토큰 비용의 역수로 계산

3. **도메인 매칭**: 도메인이 프로바이더 능력에 포함되면 +30점

4. **상위 선택**: 최고 스코어 프로바이더 반환

우선순위 없이 요청하면 기본값은 "quality".

## 개발 명령어

```bash
# 개발 서버 (hot reload)
npm run dev

# TypeScript 컴파일
npm run build

# 프로덕션 실행
npm start

# 테스트 (curl)
curl http://localhost:3001/health
curl http://localhost:3001/providers

curl -X POST http://localhost:3001/route \
  -H "Content-Type: application/json" \
  -d '{
    "routing_metadata": {
      "domain": "code",
      "priority": "speed"
    }
  }'

curl -X POST http://localhost:3001/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "gemini_flash",
    "input_tokens": 500,
    "output_tokens": 1000
  }'
```

## 주요 설계 결정

- **스트리밍 미지원**: x402 선불 모델과 호환 불가
- **서버가 API 키 보유**: 클라이언트 API 키 불필요, 보안 강화
- **요청 내용 절대 로깅 금지**: 프라이버시 보호. 메타데이터만 기록
- **x402 Graceful Fallback**: Node 20 미만에서 결제 검증 없이 동작 (개발 모드)
- **프로바이더별 x402 가격**: 티어별이 아닌 개별 가격 설정
- **요청 타임아웃**: 일반 30초, thinking/reasoner 120초

## 알려진 제한사항

- **Node 16 x402 fetch 에러**: Node 20+ 필수
- **x402 RouteConfigurationError 비동기 발생**: unhandledRejection 핸들러로 처리
- **더미 API 키**: 실제 API 키 없으면 healthCheck false (정상)
- **스트리밍**: 지원 안 함

## 로깅 정책

- 메타데이터만 기록 (method, path, status, duration, timestamp)
- 요청 컨텐츠 절대 기록 금지
- API 키 절대 기록 금지
- 에러 메시지는 일반화하여 기록

## x402 통합

- Base Sepolia USDC 마이크로페이먼트
- `/request/:provider_id` 엔드포인트 자동 보호
- 동적 라우트 생성 (setupX402)
- 타임아웃 및 오류 처리 내장

## 성능 최적화

- JSON 요청 크기 제한: 1MB
- max_tokens 최대값: 16384
- 타임아웃: 30초 (thinking 120초)
- thinking_budget 최대값: 100000

## 클라이언트 현황 (최신)

클라이언트는 현재 완전히 구현된 상태로, 다음 기능들이 포함됩니다:

### 프론트엔드 기술 스택
- React 19 + Vite 6 + TailwindCSS v4
- wagmi v2 + viem v2 (MetaMask 지갑 연동)
- x402-fetch v1.0.0 (마이크로페이먼트)
- TanStack React Query (데이터 패칭)
- recharts v3 (차트/그래프)

### 구현된 기능
| 기능 | 설명 |
|------|------|
| **채팅 인터페이스** | 다중 AI 제공자 채팅 + x402 USDC 결제 |
| **대화 관리** | 대화 목록 사이드바 (생성, 이름 변경, 삭제, 즐겨찾기) |
| **PII 보호** | 실시간 PII 탐지 오버레이 (마스킹/진행 선택) |
| **제공자 배지** | 각 응답의 AI 제공자 + 티어 정보 표시 |
| **우선순위 전환** | 비용/속도/품질 라우팅 우선순위 토글 |
| **대시보드** | 서버 상태, 설정 관리 |
| **헤더 비용 표시** | 일별/주간/월별 비용 요약 + 상세보기 링크 |
| **요금 대시보드** | 요약 카드, 기간/제공자 필터, 누적 막대 그래프, 도넛 차트, 정렬 가능한 테이블 |
| **블록체인 이력** | Base Sepolia USDC 전송 이벤트 조회 |
| **지갑 연결** | MetaMask 연결 + USDC 잔액 표시 |

### 클라이언트 Python API (FastAPI :8000)
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| POST | /analyze/ | PII 탐지 + 도메인 분류 + 라우팅 |
| GET | /health/ | Ollama + 게이트웨이 연결 상태 |
| GET | /settings/ | 사용자 설정 조회 |
| PUT | /settings/ | 사용자 설정 업데이트 |
| POST | /usage/log | 사용량 기록 저장 |
| GET | /usage/history | 사용량 이력 조회 (필터링 지원) |

### 로컬 데이터 저장
- 설정: `~/.ai-gateway/settings.json`
- 사용 이력: `~/.ai-gateway/history.jsonl`
- 대화 내역: 브라우저 localStorage (`ai-gateway-conversations`)

## 추가 참고

- **클라이언트 기술 스택**: PyWebView + React (Python 메인 + FastAPI 내장 + WebView)
- **클라이언트 아키텍처**: Python 메인 프로세스 + FastAPI 내장 서버 + WebView UI
- **OS 접근**: Python 네이티브 (os, subprocess, pathlib)
- **지갑/결제**: WebView 내 MetaMask + x402-fetch (JS)
- **Phase 4**: COSMIC 통합 → Electron/Tauri 마이그레이션 옵션
- **해커톤 구성**: PyWebView 앱 + React UI
- **프라이버시**: 서버는 원본 데이터를 절대 봐야 하지 않음
- **호환성**: TypeScript strict mode, 엄격한 타입 검사
