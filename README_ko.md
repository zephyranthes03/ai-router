# AI Router | ETHDenver 2026 Submission

**Privacy-first AI access with Edge AI + x402 micropayments + ZK accountability**

> "Everyone deserves private access to AI."

English version: `README.md`

AI Router는 민감한 AI 질의를 **로컬에서 보호**하고, 비용은 **USDC 마이크로페이먼트(x402)**로 처리하며, 사용 책임성은 **ZK 증명 + 온체인 검증**으로 보여주는 데스크톱 AI 게이트웨이입니다.

---

## 60-Second Pitch (For Judges)

1. **Problem**: People need AI most for sensitive questions, but cloud AI can expose private data.
2. **Solution**: AI Router keeps raw input on-device, sends only masked/minimal data, and routes requests to the best model.
3. **Accountability**: Usage is paid via x402 (USDC) and proven with Groth16 ZK proofs verified on Base Sepolia.
4. **Outcome**: Privacy is preserved while responsible AI usage remains publicly verifiable.

---

## Live on Base Sepolia

| 컨트랙트 | 주소 | 탐색기 |
|---|---|---|
| Groth16Verifier | `0x_VERIFIER_ADDRESS` | [Basescan](https://sepolia.basescan.org/address/0x_VERIFIER_ADDRESS) |
| ProofRegistry | `0x_REGISTRY_ADDRESS` | [Basescan](https://sepolia.basescan.org/address/0x_REGISTRY_ADDRESS) |

> 배포 후 `cd contracts && npx hardhat run scripts/deploy.ts --network baseSepolia`을 실행하면 실제 주소가 반영됩니다. 스크립트가 `deployed-addresses.json`을 저장하고 Basescan에 자동 인증합니다.

---

## 1) What We Built

- **Edge AI privacy layer**: 로컬 LLM + 규칙 기반 PII 탐지/마스킹
- **Multi-provider AI routing**: Anthropic / OpenAI / DeepSeek / Gemini 자동 라우팅
- **x402 micropayments**: Base Sepolia USDC 기반 요청 단위 결제
- **ZK accountability**: 사용량 + x402 tx hash root를 함께 증명(Groth16)하고 스마트 컨트랙트에서 검증
- **Billing observability**: 요청/토큰/비용 추적 및 대시보드 시각화

---

## 2) Why It Matters

민감한 질문일수록 AI 도움이 필요하지만, 그대로 클라우드에 보내는 구조는 프라이버시 리스크가 큽니다.

AI Router의 접근:
- **내용은 숨기고**
- **사용 책임은 증명**
- **비용은 투명하게 결제/검증**

즉, "감시 없는 투명성"을 목표로 합니다.

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
7. 온체인에서 `verifyProof` 성공 확인

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

### Run local app (3 terminals)

```bash
# Terminal 1: gateway
cd server
npm install
cp .env.example .env
npm run dev
```

```bash
# Terminal 2: frontend
cd client/frontend
npm install
cp .env.example .env.local
npm run dev
```

```bash
# Terminal 3: python backend + desktop
cd client
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
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

- **Privacy-preserving AI**: 원문 보호 + 최소 전송
- **On-chain accountability**: 데이터 공개 없이 사용 증명
- **Practical UX**: 실제 결제/라우팅/대시보드까지 end-to-end 연결

트랙별 제출 스토리:
- [**x402 Payment Track** → `docs/BOUNTY-x402.md`](docs/BOUNTY-x402.md)
- [**ZK / Privacy Track** → `docs/BOUNTY-ZK-Privacy.md`](docs/BOUNTY-ZK-Privacy.md)

---

## 10) Status

- x402 결제 및 라우팅 파이프라인 동작
- ZK 회로/증명 생성 파이프라인 동작
- `ProofRegistry` 온체인 검증 테스트 통과
- `tier + speed_quality_weight` 라우팅 시나리오 테스트 통과
- 프런트엔드에서 proof 생성/제출 UI 연동

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
