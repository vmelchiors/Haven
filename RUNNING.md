# 🚀 Haven — Guia de Execução e Desenvolvimento

Este documento contém todas as instruções necessárias para configurar, executar e implantar os módulos do ecossistema **Haven** (Backend Go, Web Frontend, Desktop App Tauri e Implantação de Produção).

---

## 📋 Pré-requisitos Gerais

Antes de iniciar, certifique-se de ter instalado em sua máquina:

- **Go**: Versão 1.24 ou superior ([golang.org](https://go.dev))
- **Node.js**: Versão 20 ou superior e **npm** ([nodejs.org](https://nodejs.org))
- **Rust & Cargo**: (Obrigatório apenas para o app Desktop com Tauri v2) ([rust-lang.org](https://www.rust-lang.org))
- **Docker & Docker Compose**: (Opcional, para execução em containers) ([docker.com](https://www.docker.com))

---

## 🛠️ 1. Executando o Backend (Go)

O backend do Haven é uma API REST modular e Hub WebSocket de alta performance escrita em Go com banco de dados SQLite em modo WAL.

### Instalação de dependências e testes:
```bash
cd backend
go mod download
go test -v ./...
```

### Variáveis de Ambiente (Opcionais / Defaults):
| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `8080` | Porta HTTP da API e WebSocket |
| `DB_PATH` | `haven.db` | Caminho do arquivo SQLite |
| `JWT_SECRET` | `haven_jwt_secret...` | Segredo de assinatura de tokens JWT |
| `LIVEKIT_URL` | `http://localhost:7880` | URL do SFU LiveKit |
| `LIVEKIT_API_KEY` | `haven_key` | Chave de API do LiveKit |
| `LIVEKIT_API_SECRET` | `haven_secret...` | Segredo de API do LiveKit |

### Iniciando o servidor:
```bash
go run ./cmd/server
```
O servidor estará acessível em: `http://localhost:8080`.

---

## 🌐 2. Executando o Frontend Web (React + Vite)

O cliente Web é um Single Page Application (SPA) moderno com suporte a WebRTC, Chat contínuo e temas minimalistas.

### Instalação e execução em modo de desenvolvimento:
```bash
cd web
npm install
npm run dev
```
Acesse a aplicação no navegador em: `http://localhost:5173`.

### Executando a suite de testes e build de produção:
```bash
npm test -- --run
npm run build
```

---

## 🖥️ 3. Executando o App Desktop (Tauri v2 + Rust)

O cliente Desktop oferece integração nativa com o sistema operacional, hooks de teclado globais para Push-to-Talk e menor consumo de recursos.

### Instalação e execução em modo de desenvolvimento:
```bash
cd desktop
npm install
npm run tauri dev
```

### Gerando o instalador/binário de produção:
```bash
npm run tauri build
```

---
