# Haven Android

Cliente Android nativo inicial em Kotlin/Jetpack Compose. Ele cobre login,
navegação por comunidades/canais e entrada em canal de voz pelo mesmo backend e
LiveKit usados pelos clientes web/desktop.

Os modelos `model_quant_1.tflite` e `model_quant_2.tflite` ficam empacotados em
`app/src/main/assets`. O `DtlnAudioProcessor` os conecta ao pós-processamento de
captura do LiveKit. A inferência é local; quando o dispositivo ou o modelo não é
compatível, o áudio continua pelo processamento nativo do WebRTC.

## Executar

1. Abra esta pasta no Android Studio.
2. Em `local.properties`, configure o SDK e, se necessário, substitua o backend público padrão:

   ```properties
   sdk.dir=C\:\\Android\\Sdk
   HAVEN_API_URL=http://10.0.2.2:8080
   ```

3. Execute a variante `debug`. Por padrão, todas as variantes usam
   `https://haven.vmelchior.tech`. O endereço `http://10.0.2.2:8080` acima é
   útil somente para alcançar um backend local pelo emulador.

Para um build release, `HAVEN_API_URL` deve ser HTTPS e pode ser passado por
variável de ambiente ou propriedade Gradle:

```bash
./gradlew :app:assembleRelease -PHAVEN_API_URL=https://haven.vmelchior.tech
```

Esta primeira versão é deliberadamente enxuta: voz é funcional; chat em tempo
real, vídeo, tela compartilhada, cadastro/recuperação e publicação na Play Store
ficam para as próximas iterações.
