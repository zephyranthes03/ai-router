# AI Gateway 클라이언트

Privacy-First AI Gateway의 데스크톱 클라이언트 애플리케이션입니다. PyWebView + React로 구축되어 로컬에서 PII 보호, 도메인 분류, 지능형 라우팅을 수행합니다.

## 아키텍처

클라이언트는 두 가지 주요 구성 요소로 이루어져 있습니다:

### Python 백엔드 (FastAPI, 포트 8000)
- **분석 파이프라인**: 사용자 메시지 → Regex PII 스캔 → Ollama Llama 분석 → 서버 라우팅
- **PII 탐지**: 정규식 패턴 + LLM 기반 개인정보 탐지 및 마스킹
- **도메인 분류**: code, analysis, writing, math, reasoning, simple_qa, general
- **설정 관리**: 우선순위, PII 모드, Extended Thinking, Web Search 등
- **사용량 로깅**: JSONL 형식으로 `~/.ai-gateway/history.jsonl`에 저장

### React 프론트엔드 (Vite, 포트 5173)
- **채팅 UI**: 다중 AI 제공자 채팅 + x402 USDC 마이크로페이먼트
- **대화 관리**: 사이드바에서 대화 생성/이름 변경/삭제/즐겨찾기
- **PII 보호**: 실시간 PII 탐지 오버레이, 마스킹 전/후 비교
- **요금 대시보드**: 비용 요약, 차트, 테이블, 블록체인 이력
- **지갑 연동**: MetaMask + Base Sepolia USDC 잔액 표시

## 필수 요구 사항

| 항목 | 버전 | 용도 |
|------|------|------|
| Python | 3.9+ | 백엔드 서버 |
| Node.js | 20+ | 프론트엔드 빌드 |
| npm | 10+ | 패키지 관리 |
| Ollama | 최신 | 로컬 LLM (PII 탐지 + 도메인 분류) |
| MetaMask | 최신 | 지갑 연동 (브라우저 확장) |

## 설치

### 1. Python 의존성 설치

```bash
cd client
pip install -r requirements.txt
```

주요 패키지:
- `fastapi` >= 0.115.0
- `uvicorn` >= 0.34.0
- `pywebview` >= 5.3
- `httpx` >= 0.28.0
- `pydantic` >= 2.10.0
- `python-dotenv` >= 1.0.0

### 2. 프론트엔드 의존성 설치

```bash
cd client/frontend
npm install
```

주요 패키지:
- `react` ^19.0.0
- `wagmi` ^2.14.0 / `viem` ^2.22.0
- `x402-fetch` ^1.0.0
- `@tanstack/react-query` ^5.62.0
- `recharts` ^3.7.0
- `tailwindcss` ^4.0.0

### 3. 환경 변수 설정

```bash
cd client
cp .env.example .env
```

`.env` 파일 편집:
```bash
# 게이트웨이 서버 주소
GATEWAY_SERVER_URL=http://localhost:3001

# Ollama (로컬 LLM)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# 포트 (선택사항)
LOCAL_API_PORT=8000
```

### 4. Ollama 설정

```bash
# Ollama 설치 (macOS)
brew install ollama

# Ollama 서버 시작
ollama serve

# 모델 다운로드
ollama pull llama3.2:3b
```

### 5. MetaMask + Base Sepolia 설정

1. MetaMask 브라우저 확장 설치
2. Base Sepolia 테스트넷 네트워크 추가:
   - 네트워크 이름: Base Sepolia
   - RPC URL: https://sepolia.base.org
   - 체인 ID: 84532
   - 통화 기호: ETH
   - 블록 탐색기: https://sepolia.basescan.org
3. 테스트넷 ETH 및 USDC 확보 (faucet 사용)

## 실행

### 개발 모드 (권장)

3개의 터미널이 필요합니다:

**터미널 1 - 게이트웨이 서버:**
```bash
cd server
npm run dev
# → http://localhost:3001
```

**터미널 2 - 프론트엔드 개발 서버:**
```bash
cd client/frontend
npm run dev
# → http://localhost:5173
```

**터미널 3 - Python 백엔드:**
```bash
cd client
DEV=true python main.py
# → FastAPI http://localhost:8000
# → PyWebView가 http://localhost:5173을 로드
```

> `DEV=true` 환경 변수가 설정되면 PyWebView가 Vite 개발 서버(5173)를 로드합니다.
> 설정하지 않으면 빌드된 정적 파일(`frontend/dist/`)을 로드합니다.

### 프로덕션 모드

```bash
# 프론트엔드 빌드
cd client/frontend
npm run build

# 애플리케이션 실행
cd client
python main.py
```

### API 전용 모드 (PyWebView 없이)

PyWebView가 설치되지 않은 환경에서는 자동으로 API 전용 모드로 실행됩니다:

```bash
cd client
python main.py
# FastAPI가 포트 8000에서 실행됨
# 브라우저에서 http://localhost:5173 접속 (프론트엔드 별도 실행 필요)
```

## 사용법

### 채팅

1. 앱 상단에서 **Tier**(Budget/Standard/Premium)와 **Spd↔Qlty 슬라이더**를 조정
2. 하단 입력창에 메시지 입력 후 Send 또는 Enter
3. 메시지가 자동으로:
   - PII 탐지 → PII가 있으면 마스킹 리뷰 오버레이 표시
   - 도메인 분류 + 최적 제공자 라우팅
   - x402 USDC 마이크로페이먼트 결제
   - AI 응답 표시 (제공자/티어/비용 정보 포함)

### 대화 관리

- 좌측 사이드바에서 대화 목록 확인
- **+ 버튼**: 새 대화 생성
- **대화 이름 클릭**: 해당 대화로 전환
- **이름 더블클릭**: 대화 이름 변경
- **별표 아이콘**: 즐겨찾기 토글
- **삭제 아이콘**: 대화 삭제
- 매일 자동으로 오늘 날짜의 대화가 생성됨
- 첫 번째 메시지로 자동 이름 설정

### PII 보호

PII(개인식별정보)가 탐지되면 오버레이가 표시됩니다:
- 원본 텍스트와 마스킹된 텍스트를 나란히 비교
- **Send Masked**: 마스킹된 텍스트로 전송 (프라이버시 보호)
- **Cancel**: 메시지 전송 취소

PII 모드 설정 (Dashboard > Settings):
- **strict**: 모든 PII 마스킹
- **balanced**: 중요 PII만 마스킹
- **permissive**: PII 탐지만 수행, 마스킹 최소화

### 요금 확인

**헤더 비용 위젯:**
- 앱 상단에 현재 기간의 총 비용 표시
- 클릭하면 일별 → 주간 → 월별 순환
- 돋보기 아이콘 클릭으로 상세 Billing 페이지 이동

**Billing 페이지:**
- 상단 탭에서 **Billing** 클릭
- 요약 카드: 총 비용, USDC 청구액, 요청 수, 토큰 수, 최다 사용 제공자
- 기간 필터: Daily / Weekly / Monthly / Custom (날짜 범위 직접 선택)
- 제공자 필터: All 또는 개별 제공자 선택
- 차트:
  - 누적 막대 그래프: 시간별 비용 추이 (제공자별 색상)
  - 도넛 차트: 제공자별 비용 비율
- 사용 기록 테이블: 날짜, 제공자, 티어, 토큰, 비용 (정렬 가능, 페이지네이션)
- 블록체인 이력: Base Sepolia에서의 USDC 전송 이벤트 (BaseScan 링크)

### 설정 변경

Dashboard 탭에서 설정 관리:
- **Tier**: 기본 비용 레벨 (budget/standard/premium)
- **Speed-Quality Weight**: 라우팅 가중치 (0=속도 우선, 100=품질 우선)
- **PII Mode**: 개인정보 보호 수준 (strict/balanced/permissive)
- **Extended Thinking**: 확장된 사고 모드 활성화 (프리미엄 모델)
- **Web Search**: 웹 검색 기능 활성화 (지원 모델)
- **Ollama**: 로컬 LLM 활성화/비활성화

### ZK 검증 (x402 tx 바인딩)

- Billing > ZK Verification 패널에서 proof 생성 시 서버가 x402 `onAfterSettle`로 수집한 `txHash`를 사용합니다.
- 서버는 `txHashesRoot`(Poseidon hash chain)를 계산하고, commitment에 포함해 proof를 생성합니다.
- 온체인 `ProofRegistry`에는 `txHashesRoot`가 저장되며, UI의 proof history에서 확인할 수 있습니다.
- transfer 데이터가 없으면 해당 레코드는 자동으로 0 패딩되어 proof에 반영됩니다.

## 클라이언트 API 엔드포인트 (FastAPI :8000)

### POST /analyze/

사용자 메시지를 분석합니다 (PII 탐지 + 도메인 분류 + 최적 제공자 라우팅).

요청:
```json
{
  "message": "안녕하세요, 제 이메일은 test@example.com입니다",
  "tier": "standard",
  "speed_quality_weight": 85
}
```

응답:
```json
{
  "masked_text": "안녕하세요, 제 이메일은 [EMAIL_1]입니다",
  "pii_report": {
    "detections": [...],
    "count": 1,
    "has_critical": false
  },
  "routing": {
    "provider_id": "claude_sonnet",
    "provider_name": "Claude Sonnet 4.5",
    "tier": "standard",
    "x402_price": "$0.01",
    "endpoint": "/request/claude_sonnet",
    "reasoning": "Selected Claude Sonnet 4.5 (tier=standard, weight=85): speed 60x0.15 + quality 80x0.85 = 77.0",
    "source": "server"
  }
}
```

### GET /health/

서버 및 Ollama 상태를 확인합니다.

응답:
```json
{
  "status": "ok",
  "ollama_available": true,
  "ollama_model": "llama3.2:3b",
  "gateway_server": "http://localhost:3001",
  "gateway_reachable": true
}
```

### GET /settings/ & PUT /settings/

사용자 설정을 조회하거나 업데이트합니다.

GET 응답:
```json
{
  "tier": "standard",
  "speed_quality_weight": 50,
  "pii_mode": "balanced",
  "max_budget_per_request": 0.05,
  "preferred_providers": [],
  "ollama_enabled": true,
  "extended_thinking": false,
  "web_search": false
}
```

### POST /usage/log

사용량 기록을 저장합니다 (Fire-and-forget).

요청:
```json
{
  "id": "uuid",
  "timestamp": 1707600000000,
  "provider_id": "claude_sonnet",
  "provider_name": "Claude Sonnet 4.5",
  "tier": "standard",
  "cost": { "input_cost": 0.001, "output_cost": 0.002, "actual_total": 0.003, "charged": 0.01 },
  "tokens": { "input": 100, "output": 200 }
}
```

### GET /usage/history

사용량 이력을 조회합니다.

쿼리 파라미터:
- `start_ts`: 시작 타임스탬프 (밀리초)
- `end_ts`: 종료 타임스탬프 (밀리초)
- `provider_id`: 특정 제공자 필터
- `limit`: 결과 제한 수

## 데이터 저장 위치

| 데이터 | 위치 | 형식 |
|--------|------|------|
| 사용자 설정 | `~/.ai-gateway/settings.json` | JSON |
| 사용량 이력 | `~/.ai-gateway/history.jsonl` | JSON Lines |
| 대화 내역 | 브라우저 localStorage | JSON |

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `GATEWAY_SERVER_URL` | http://localhost:3001 | 게이트웨이 서버 주소 |
| `OLLAMA_URL` | http://localhost:11434 | Ollama 서버 주소 |
| `OLLAMA_MODEL` | llama3.2:3b | 사용할 Ollama 모델 |
| `LOCAL_API_PORT` | 8000 | FastAPI 서버 포트 |
| `DEV` | (없음) | `true` 설정 시 개발 모드 |

## 프로젝트 구조

```
client/
├── main.py                      # 진입점 (PyWebView + FastAPI)
├── requirements.txt             # Python 의존성
├── .env.example                 # 환경 변수 템플릿
├── app/                         # Python 백엔드
│   ├── api/
│   │   ├── server.py            # FastAPI 앱 팩토리
│   │   └── routes/
│   │       ├── analyze.py       # POST /analyze (분석 파이프라인)
│   │       ├── health.py        # GET /health (상태 확인)
│   │       ├── settings.py      # 설정 CRUD
│   │       └── usage.py         # 사용량 로깅/이력
│   ├── agent/                   # OS 접근 (파일, 셸, 시스템)
│   ├── bridge/api.py            # PyWebView JavaScript 브릿지
│   ├── config/
│   │   ├── constants.py         # 앱 상수 (포트, 경로, 체인 ID)
│   │   └── settings.py          # UserSettings 모델
│   ├── llm/
│   │   ├── analyzer.py          # Ollama/Llama 분석기
│   │   ├── parser.py            # LLM 응답 파서
│   │   └── prompt.py            # 분석 프롬프트 템플릿
│   ├── orchestrator.py          # 분석 오케스트레이터
│   ├── pii/
│   │   ├── patterns.py          # PII 정규식 패턴
│   │   ├── regex_layer.py       # Regex PII 스캐너
│   │   └── strategies.py        # PII 마스킹 전략
│   └── routing/
│       ├── fallback_engine.py   # 폴백 라우터
│       ├── server_router.py     # 서버 라우팅 클라이언트
│       └── types.py             # 라우팅 타입
│
└── frontend/                    # React 프론트엔드
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── App.tsx              # 메인 앱 (탭/사이드바/라우팅)
        ├── types/index.ts       # TypeScript 타입 정의
        ├── lib/
        │   ├── localApi.ts      # FastAPI HTTP 클라이언트
        │   ├── wagmiConfig.ts   # wagmi/지갑 설정
        │   └── contracts.ts     # USDC 컨트랙트 ABI
        ├── hooks/
        │   ├── useAnalyze.ts    # 분석 훅
        │   ├── useX402Request.ts # x402 결제 훅
        │   ├── useWallet.ts     # 지갑/USDC 잔액 훅
        │   ├── useUsageData.ts  # 사용량 집계 훅
        │   └── useUsdcTransfers.ts # 블록체인 이벤트 훅
        └── components/
            ├── Chat.tsx         # 채팅 인터페이스
            ├── MessageBubble.tsx # 메시지 버블
            ├── PiiOverlay.tsx   # PII 리뷰 오버레이
            ├── ProviderBadge.tsx # 제공자 배지
            ├── PriorityToggle.tsx # Tier + Spd/Qlty 제어 UI
            ├── WalletConnect.tsx # 지갑 연결 버튼
            ├── Dashboard.tsx    # 대시보드/설정
            ├── ConversationList.tsx # 대화 목록 사이드바
            ├── HeaderCostDisplay.tsx # 헤더 비용 위젯
            ├── BillingPage.tsx  # 요금 대시보드
            └── billing/
                ├── BillingFilters.tsx  # 기간/제공자 필터
                ├── BillingChart.tsx    # 막대+파이 차트
                ├── BillingTable.tsx    # 사용 기록 테이블
                └── BlockchainHistory.tsx # USDC 전송 이력
```

## 트러블슈팅

### Ollama 연결 실패
```bash
# Ollama가 실행 중인지 확인
ollama list

# 모델이 설치되어 있는지 확인
ollama pull llama3.2:3b
```

### MetaMask 연결 문제
- Base Sepolia 네트워크가 추가되어 있는지 확인
- 계정에 테스트넷 ETH와 USDC가 있는지 확인
- 브라우저에서 MetaMask 확장이 활성화되어 있는지 확인

### FastAPI 서버 시작 실패
```bash
# 포트 8000이 사용 중인지 확인
lsof -i :8000

# 의존성이 모두 설치되어 있는지 확인
pip install -r requirements.txt
```

### 게이트웨이 서버 연결 실패
- 서버가 포트 3001에서 실행 중인지 확인
- `.env`의 `GATEWAY_SERVER_URL`이 올바른지 확인
