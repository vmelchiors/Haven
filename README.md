# Haven — Private Real-Time Communication Platform

[![Backend CI](https://img.shields.io/badge/Backend%20CI-Passing-emerald.svg?logo=go&logoColor=white)](backend/)
[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](LICENSE)
[![Zero-PII](https://img.shields.io/badge/Privacy-Zero--PII-emerald.svg)](RUNNING.md)
[![WebRTC P2P & SFU](https://img.shields.io/badge/WebRTC-P2P%20Mesh%20%26%20LiveKit-cyan.svg)](https://webrtc.org)

**Haven** é uma plataforma de comunicação em tempo real focada em privacidade, baixa latência e simplicidade. A aplicação oferece canais de voz, chamadas de vídeo, compartilhamento de tela e chat de texto instantâneo, operando sob uma arquitetura orientada à privacidade (Zero-PII).

Disponível como **aplicativo desktop nativo** (Windows, macOS e Linux via Tauri v2) e **aplicativo web (SPA)** para navegadores.

---

## Funcionalidades

- **Privacidade e Zero-PII:** Cadastro e uso sem coleta de e-mails, números de telefone ou documentos pessoais. Autenticação baseada em pseudônimo e hashing seguro com Argon2id/Bcrypt.
- **Comunicação por Voz e Vídeo:** Canais de voz persistentes em segundo plano com detecção de atividade de voz (VAD), chamadas de vídeo e compartilhamento de tela.
- **Foco de Voz por IA:** O microfone passa por um modelo DTLN quantizado executado localmente via WebAssembly e AudioWorklet antes de ser publicado no P2P ou LiveKit. Se a IA não carregar, a chamada continua com fallback automático.
- **Arquitetura WebRTC Híbrida:** Suporte a conexões peer-to-peer (P2P Mesh) de baixa latência para grupos menores e escalabilidade com SFU (LiveKit).
- **Chat de Texto em Tempo Real:** Troca de mensagens instantâneas com paginação por cursor, virtualização de lista para alto desempenho e indicadores de digitação.
- **Gestão de Comunidades:** Criação de servidores públicos ou privados, controle de permissões e moderação de membros.

---

## Tecnologias Utilizadas

- **Backend:** Go (API REST, WebSocket Hub, SQLite com modo WAL).
- **Frontend Web:** React, TypeScript, Tailwind CSS, Vite.
- **Desktop:** Tauri v2, Rust, React.
- **Comunicação em Tempo Real:** WebRTC, LiveKit SFU.
- **Realce de Fala:** [DTLN](https://github.com/breizhn/DTLN) via LiteRT/WASM, baseado no estudo [Dual-Signal Transformation LSTM Network for Real-Time Noise Suppression](https://www.isca-archive.org/interspeech_2020/westhausen20_interspeech.pdf).

---

## Desenvolvimento e Contribuição

Contribuições são bem-vindas. Para contribuir com o projeto:

1. Faça um Fork do repositório.
2. Crie uma branch para sua alteração (`git checkout -b feature/nome-da-feature`).
3. Consulte o guia em [RUNNING.md](RUNNING.md) para instruções detalhadas de configuração do ambiente, execução local dos serviços e testes.
4. Envie suas alterações e abra um Pull Request detalhando as melhorias implementadas.

---

## Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para mais informações.
