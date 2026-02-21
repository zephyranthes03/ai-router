# ProofRoute AI | ETHDenver 2026 Submission

**Privacy-first AI access with Edge AI + x402 micropayments + ZK accountability**

> "Everyone deserves private access to AI."

English version: `README.md`

ProofRoute AI는 민감한 AI 질의를 **로컬에서 보호**하고, 비용은 **USDC 마이크로페이먼트(x402)**로 처리하며, 사용 책임성은 **ZK 증명 + 온체인 검증**으로 보여주는 데스크톱 AI 게이트웨이입니다.

---

## 60초 피치 (심사위원용)

1. **문제**: 민감한 질문일수록 AI 도움이 필요하지만, 클라우드 전송은 프라이버시 리스크가 크고 구독형 과금은 비용 비효율이 발생하기 쉽습니다.
2. **해결**: ProofRoute AI는 원문을 디바이스에 남기고 마스킹된 최소 정보만 전송하며, Adaptive AI orchestration으로 요청마다 최적 모델을 선택합니다.
3. **결제 + 책임성**: x402 USDC 마이크로결제로 구독료 없이 사용량만큼 결제하고, Groth16 ZK 증명으로 Base Sepolia에서 검증 가능한 사용 기록을 남깁니다.
4. **결과**: 원문 노출 없이 프라이버시를 지키면서 성능/비용 효율과 공개 검증 가능성을 동시에 확보합니다.

---

## Live on Base Sepolia

| 컨트랙트 | 주소 | 탐색기 |
|---|---|---|
| Groth16Verifier | `0xb4339750209d01002bf915b8854BEcDB89731BC2` | [Basescan](https://sepolia.basescan.org/address/0xb4339750209d01002bf915b8854BEcDB89731BC2) |
| ProofRegistry | `0xda6a8156636a85C76C1bAdb140BFb1932F999855` | [Basescan](https://sepolia.basescan.org/address/0xda6a8156636a85C76C1bAdb140BFb1932F999855) |

> 배포 후 `cd contracts && npx hardhat run scripts/deploy.ts --network baseSepolia`을 실행하세요. 스크립트가 `contracts/deployed-addresses.json`을 저장하고, Basescan 자동 인증 후 `client/frontend/.env.local`의 `VITE_PROOF_REGISTRY_ADDRESS`를 업데이트합니다.

---

## 1) What We Built

- **Edge AI privacy layer**: Regex + Presidio + 로컬 LLM 기반의 디바이스 내 다중 신호 PII 보호, 클라우드 전송 전 플레이스홀더 마스킹 + 응답 후 안전 복원으로 UX 유지
- **Adaptive AI orchestration**: Anthropic / OpenAI / DeepSeek / Gemini를 대상으로, tier·속도/품질 선호·도메인 적합도·필수 capability(extended thinking/web search/context)에 따라 실시간으로 모델을 선택해 정적 라우팅보다 품질 대비 비용 효율을 최적화
- **x402 micropayments**: Base Sepolia USDC 기반 요청 단위 결제/정산
- **ZK accountability**: 사용량 + x402 tx hash root를 함께 증명(Groth16)하고 온체인에서 검증
- **Billing observability**: 요청/토큰/비용을 투명하게 추적하고 대시보드로 가시화

---

## 2) Why It Matters

민감한 질문일수록 AI 도움이 필요하지만, 그대로 클라우드에 보내는 구조는 프라이버시 리스크가 큽니다.
또한 기존 구독형 AI는 사용량이 적어도 월 구독료를 선결제해야 하고, 어떤 모델을 쓸지 사용자가 직접 판단해야 해서 비용/성능 효율이 떨어지기 쉽습니다.

ProofRoute AI의 접근:
- **내용은 숨기고**: 원문은 로컬에서 처리하고 마스킹된 정보만 전송
- **요금은 사용한 만큼만**: x402 USDC 마이크로결제로 구독료 없이 요청 단위 pay-as-you-go
- **모델 선택은 상황에 맞게**: Adaptive AI orchestration이 tier, 속도/품질 선호, 도메인, capability를 반영해 성능 대비 비용을 최적화
- **사용 책임은 증명**: ZK 증명과 온체인 검증으로 결과를 검증 가능하게 유지

즉, "감시 없는 투명성"과 "낭비 없는 AI 비용 구조"를 함께 목표로 합니다.

---

## 3) System Architecture

```text
[User]
  -> [Edge AI: local PII detection/masking]
  -> [Gateway: routing + x402 verification + provider call]
  -> [Usage collector + ZK proof generator]
  -> [ProofRegistry on Base Sepolia]
```

### 3-layer privacy model

1. **Local (private)**: 원문 입력/PII 처리
2. **Gateway (minimal exposure)**: 마스킹 텍스트 + 라우팅 메타데이터
3. **On-chain (verifiable)**: 증명 결과만 기록 (원문/세부 사용내역 미공개)

---

## 4) Hackathon Demo Flow (Judge-friendly)

> **[3분 데모 가이드 → DEMO.md](DEMO.md)** — 정확한 커맨드와 예상 출력이 포함된 단계별 안내서.

1. 사용자가 민감 정보 포함 질의 입력
2. 로컬에서 PII 탐지 및 마스킹
3. 마스킹된 요청만 게이트웨이로 전송
4. x402 USDC 결제 후 AI 응답 수신
5. 사용량 배치를 기반으로 ZK proof 생성
6. Base Sepolia `ProofRegistry`에 proof 제출
7. 온체인에서 `submitAndVerify` 성공 및 `ProofVerified` 이벤트 확인

---

## 5) Repository Layout

- `server/`: Express + TypeScript 게이트웨이 (x402 검증, provider 프록시)
- `client/`: Python 오케스트레이터 + 데스크톱 앱
- `client/frontend/`: React UI (채팅, 빌링, 지갑, proof 제출)
- `circuits/`: circom 회로 + snarkjs setup
- `contracts/`: Hardhat + `Groth16Verifier.sol` + `ProofRegistry.sol`

상세 API/컴포넌트 설명:
- `server/README.md`
- `client/README.md`

---

## 6) Quick Start

### Prerequisites

- Node.js 20+ (**Hardhat는 22 권장**)
- Python 3.9+
- npm 10+
- Ollama (로컬 분류/PII 파이프라인 데모 시)
- MetaMask (Base Sepolia)
- (선택) Docker (circom 대체 실행)

### 최초 로컬 설정 (1회 실행)

```bash
# 로컬 env 파일은 최초 1회만 복사하세요.
# 이 명령을 반복 실행하면 기존 로컬 설정이 덮어써질 수 있습니다.
cp server/.env.example server/.env
cp client/frontend/.env.example client/frontend/.env.local
```

### Run local app (3 terminals)

```bash
# Terminal 1: gateway
cd server
npm install
npm run dev
```

```bash
# Terminal 2: frontend
cd client/frontend
npm install
npm run dev
```

```bash
# Terminal 3: python backend
cd client
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
DEV=1 python main.py
```

---

## 7) ZK Setup & On-chain Test

### Step A: circuits artifacts

`circom` 컴파일 단계는 두 가지 중 하나를 선택합니다.

#### Option A) Local `circom` binary (fast iteration)

```bash
cargo install --git https://github.com/iden3/circom.git --tag v2.1.8 --locked
```

```bash
cd circuits
npm install
npm run compile
npm run setup
npm run generate-verifier
```

#### Option B) Docker for `circom` compile (no local binary)

```bash
docker pull ghcr.io/iden3/circom:2.1.8
```

```bash
cd circuits
npm install

docker run --rm \
  -v "$PWD:/work" \
  -w /work \
  ghcr.io/iden3/circom:2.1.8 \
  circom circuits/usage_budget.circom --r1cs --wasm --sym -o build

npm run setup
npm run generate-verifier
```

> 참고: Docker 대체는 **circom 컴파일 단계만**입니다. `setup`/`generate-verifier`는 `snarkjs`(Node)로 실행됩니다.

### Tx-binding 모델 (x402 -> ZK)

- commitment 구조를 `Poseidon(totalCost, requestCount, salt)`에서 아래로 변경:
  `Poseidon(totalCost, requestCount, txHashesRoot, salt)`
- `txHashesRoot`는 최대 32개 tx hash에 대한 Poseidon hash chain으로 계산:
  `chain[0]=txHashes[0]`, `chain[i]=Poseidon(chain[i-1], txHashes[i])`
- public signal은 4개로 확장:
  `[budgetLimit, requestCount, commitmentHash, txHashesRoot]`
- `ProofRegistry`가 `txHashesRoot`를 저장하므로, 제3자가 온체인 transfer 내역으로 root를 재계산해 대조 검증할 수 있습니다.

### Step B: 자동 테스트 실행

```bash
# 라우팅/제어 로직 테스트
cd server
npm install
npm test

# 스마트 컨트랙트 + 온체인 verifier 연동 테스트
cd contracts
npm install
npm test
```

- 라우팅 테스트: `server/src/routing/select-provider.test.ts`
- ZK 입력/tx-binding 테스트: `server/src/zk/proof-generator.test.ts`
- 컨트랙트 테스트: `contracts/test/ProofRegistry.test.ts`
- fixture: `contracts/test/fixtures/usageBudgetProofInput.ts`
- 컨트랙트 테스트는 더미 proof가 아니라 `snarkjs.groth16.fullProve`로 **실제 proof**를 생성해 검증합니다.

프론트 온체인 제출 주소 자동 반영:

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network baseSepolia
```

- 위 배포 스크립트는 `contracts/deployed-addresses.json`을 저장하고,
- `client/frontend/.env.local`의 `VITE_PROOF_REGISTRY_ADDRESS`도 자동 업데이트합니다.

---

## 8) Validation Scope (Current)

| Layer | Validation |
|---|---|
| `contracts` | Hardhat unit tests (`npm test`) |
| `circuits` | compile/setup/verifier generation |
| `server` | 라우팅 + ZK 입력 빌더 단위 테스트 (`npm test`) + TypeScript build (`npm run build`) |
| `client/frontend` | production build (`npm run build`) |

현재 `client/frontend`, `client`(Python)는 별도 unit test 스위트보다 빌드/실행 검증 중심입니다.

### 라우팅 제어 시나리오 (`tier` + `speed_quality_weight`)

| 시나리오 | 입력 | 기대 결과 |
|---|---|---|
| 비용 민감 + 속도 | `tier=budget`, `speed_quality_weight=0` | `haiku` 선택 |
| 비용 민감 + 품질 | `tier=budget`, `speed_quality_weight=100` | `gemini_flash` 선택 |
| 표준 비용 + 속도 | `tier=standard`, `speed_quality_weight=0` | `gpt5` 선택 |
| 표준 비용 + 품질 | `tier=standard`, `speed_quality_weight=100` | `gemini_pro` 선택 |
| capability 상향 완화 | `tier=budget`, `requires_thinking=true` | standard tier로 상향되어 `claude_sonnet` 선택 |
| domain bonus 영향 | `tier=budget`, `speed_quality_weight=0`, `domain=code` | domain bonus로 `gemini_flash` 선택 |
| 하드 fallback | `tier=premium`, `requires_web_search=true` | `claude_sonnet` fallback |

UI에서 비용 제어는 `tier` 선택으로 표현됩니다.
- 비용 절약 중심 모드 -> `budget`
- 품질 우선/비용 제약 완화 모드 -> `standard` 또는 `premium`

### ZK tx-binding 시나리오

| 시나리오 | 검증 내용 |
|---|---|
| 서버 측 tx 수집 | x402 `onAfterSettle` 훅이 `UsageRecord.txHash`를 자동 패치 |
| `/proof/generate` | 서버가 수집한 tx hash들로 `txHashesRoot`를 계산하고, 없는 값은 0 패딩 |
| commitment 무결성 | `Poseidon(totalCost, requestCount, txHashesRoot, salt)` 계산식 일치 |
| 온체인 저장/이벤트 | `ProofRegistry`가 `txHashesRoot`를 저장하고 `ProofVerified` 이벤트에 포함 |
| Groth16 호환성 | `pubSignals[4]` 기준 실제 proof 생성/검증 통과 |

---

## 9) Track/Theme Fit

- **주요 제출 포커스: Kite AI**  
  x402 결제 플로우 + 지갑 기반 에이전트 아이덴티티 + 헤드리스 자율 실행 + MIT 오픈소스 라이선스.
- **핵심 커뮤니티 적합성: Prosperia**  
  프라이버시 우선 구조와 온체인 검증 가능한 책임성.
- **추가 적합성:** Base Autonomous Agents, 0G Compute.

트랙별 제출 스토리:
- [**Kite AI — Agent-Native Payments & Identity on Kite AI (x402-Powered)** → `docs/BOUNTY-Kite-AI-Agent-Native-Payments-and-Identity-on-Kite-AI-x402-Powered.md`](docs/BOUNTY-Kite-AI-Agent-Native-Payments-and-Identity-on-Kite-AI-x402-Powered.md)
- [**Prosperia — Privacy-Preserving Accountability** → `docs/BOUNTY-Prosperia.md`](docs/BOUNTY-Prosperia.md)
- [**Base — Base Self-Sustaining Autonomous Agents** → `docs/BOUNTY-Base-Self-Sustaining-Autonomous-Agents.md`](docs/BOUNTY-Base-Self-Sustaining-Autonomous-Agents.md)
- [**0G Labs — Best Use of AI Inference or Fine Tuning (0G Compute)** → `docs/BOUNTY-0G-Labs-Best-Use-of-AI-Inference-or-Fine-Tuning-0G-Compute.md`](docs/BOUNTY-0G-Labs-Best-Use-of-AI-Inference-or-Fine-Tuning-0G-Compute.md)

---

## 10) Status

- x402 결제 및 라우팅 파이프라인 동작
- ZK 회로/증명 생성 파이프라인 동작
- `ProofRegistry` 온체인 검증 테스트 통과
- `tier + speed_quality_weight` 라우팅 시나리오 테스트 통과
- 프런트엔드에서 proof 생성/제출 UI 연동
- 헤드리스 자율 x402 데모 스크립트 제공 (`server/scripts/headless-demo.ts`)
- Base Autonomous Agents의 strict-mainnet 요구사항은 후속 작업으로 관리 중 (현재 데모 체인은 Base Sepolia)

---

## 11) Roadmap: 로컬 AI 강화 라우팅

현재 PII 마스킹에 사용 중인 로컬 LLM을 클라우드 라우팅 최적화에 활용할 수 있습니다:

- **Local-first triage**: 로컬에서 의도/복잡도를 분류 → 적합한 클라우드 모델 티어를 자동 선택
- **Context budget controller**: 클라우드 전송 전 토큰 예산 내에서 최적 프롬프트 구성
- **Evidence packer**: 로컬에서 관련 스니펫만 추출 → 클라우드 응답의 환각 감소
- **Multi-step compression**: 여러 번 클라우드를 호출해야 할 흐름을 로컬이 중간 정리하여 1회 호출로 압축

---

## Contact

ETHDenver 2026 Hackathon submission project.

For detailed implementation docs:
- `server/README.md`
- `client/README.md`
