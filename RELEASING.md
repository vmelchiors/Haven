# Releases do Haven

## Preparação única do Windows

O workflow `.github/workflows/desktop-release.yml` cria um instalador NSIS x64,
assina o pacote de atualização, publica uma GitHub Release e gera `latest.json`
para o atualizador embutido no aplicativo.

Configure no repositório GitHub:

- secret `TAURI_SIGNING_PRIVATE_KEY`: conteúdo da chave privada do updater;
- secret opcional `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: senha da chave, quando usada.

O backend padrão é `https://haven.vmelchior.tech`. A variável opcional
`HAVEN_API_URL` permite substituir essa URL, sempre sem `/api` no final.

Uma chave foi gerada localmente em `desktop/haven-updater.key` e está ignorada
pelo Git. Faça backup seguro dela antes da primeira publicação. A chave pública
correspondente já está em `tauri.conf.json`. Perder essa chave privada impede
atualizar instalações existentes.

Com GitHub CLI autenticado, a configuração pode ser feita no PowerShell:

```powershell
Get-Content -Raw desktop/haven-updater.key | gh secret set TAURI_SIGNING_PRIVATE_KEY
```

## Publicar uma versão Windows

Na pasta `desktop`, sincronize a versão e envie a alteração para `main`:

```powershell
npm run version:set -- 1.2.0
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: release desktop v1.2.0"
git push origin main
```

O workflow só publica quando ainda não existe uma release para a versão. Assim,
commits normais em `main` não sobrescrevem instaladores já distribuídos. Ao abrir,
o cliente consulta a release mais recente e oferece instalar a atualização.

## Android

O projeto em `android/` é verificado pelo workflow `Android CI`. Consulte
`android/README.md` para executar no emulador ou gerar um APK. O workflow anexa
um APK debug instalável e seu SHA-256 a cada execução, com retenção de 14 dias.
Distribuição pela Play Store exigirá uma keystore própria, conta de desenvolvedor
e um workflow de release separado; nenhum segredo de assinatura Android fica no
repositório.
