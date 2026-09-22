# ClipPublisher

Aplicação pessoal para carregar MP4/MOV e publicar vídeos prontos no TikTok (Content Posting API / Direct Post) e no YouTube (YouTube Data API). Não há cadastro, banco de dados, IA, Instagram, scraping ou automação de navegador.

## Instalação e execução

Requer Node.js 20+. Copie `.env.example` para `.env`, preencha as credenciais e gere uma chave aleatória de 32+ caracteres para `TOKEN_ENCRYPTION_KEY`.

```bash
npm install
npm run dev
```

O frontend fica em `http://localhost:5173` e o servidor em `http://localhost:3001`. Para validar antes de publicar: `npm test`. Para produção: `npm run build` e `npm run start -w server` (sirva `client/dist` por um servidor HTTPS configurado).

## Variáveis

`PORT`, `FRONTEND_URL`, `MAX_UPLOAD_BYTES` e `TEMP_FILE_MAX_AGE_HOURS` controlam o servidor. `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` e `TIKTOK_REDIRECT_URI` são do TikTok. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` são do OAuth do Google; os aliases `YOUTUBE_CLIENT_ID` e `YOUTUBE_CLIENT_SECRET` também são aceitos. Nunca exponha esses valores nem o arquivo `storage/tokens.enc`.

Em hospedagem gerenciada, defina `DATA_DIR` para o ponto de montagem de um disco persistente (por exemplo, `/var/data`).

Os tokens são criptografados localmente com AES-256-GCM no servidor; não são enviados ao browser e os logs ocultam campos de token. Para trocar a chave, reconecte as duas plataformas.

## TikTok

1. Crie o app em [TikTok for Developers](https://developers.tiktok.com/), adicione **Content Posting API** e habilite **Direct Post**.
2. Cadastre exatamente `TIKTOK_REDIRECT_URI` no app e preencha as chaves no `.env`. Para este aplicativo web, use uma URL HTTPS absoluta, estática e sem parâmetros ou fragmento — por exemplo, `https://your-domain.example/api/auth/tiktok/callback`. O valor precisa ser idêntico no portal, no `.env`, na URL de autorização e na troca do código por token.
3. Solicite somente `video.publish`. Clique em “TikTok: conectar” no ClipPublisher.

O servidor usa OAuth oficial, consulta `creator_info/query`, chama `video/init` com `FILE_UPLOAD` e transmite o arquivo à `upload_url` retornada. A API exige `video.publish` aprovado e autorizado. Clientes não auditados ficam limitados à visibilidade privada; obtenha a auditoria antes de depender de publicação pública. Formato e limite final são os informados pelo `creator_info` e pela documentação do TikTok.

## YouTube

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um cliente OAuth do tipo Web e registre exatamente `GOOGLE_REDIRECT_URI`.
2. Ative a [YouTube Data API v3](https://developers.google.com/youtube/v3) no mesmo projeto.
3. Preencha as variáveis Google e clique em “YouTube: conectar”.

É usado somente o escopo `https://www.googleapis.com/auth/youtube.upload`, com acesso offline para renovação de token. O envio ocorre via [`videos.insert`](https://developers.google.com/youtube/v3/docs/videos/insert), incluindo título, descrição, tags derivadas apenas das hashtags fornecidas e visibilidade pública, não listada ou privada. O app não promete que um vídeo vertical será reconhecido como Short: essa classificação é do YouTube. Projetos OAuth não verificados criados depois de 28/07/2020 enviam vídeos como privados até auditoria.

## Segurança e limites

Uploads aceitam exclusivamente MIME `video/mp4` e `video/quicktime`, extensão MP4/MOV e o limite configurável. Os nomes são sanitizados e os arquivos ficam em `storage/uploads` apenas durante a publicação. Um upload YouTube bem-sucedido é removido; um upload TikTok precisa ser preservado enquanto a plataforma processa, e falhas ficam disponíveis para retry na sessão. Em ambiente de produção, acrescente uma tarefa operacional para apagar arquivos temporários antigos depois de `TEMP_FILE_MAX_AGE_HOURS`.

O status TikTok é assíncrono: a resposta “enviando/publicando” representa o `publish_id`; implemente uma consulta periódica de `status/fetch` se quiser exibir o resultado final após sair da sessão. A URL pública do TikTok não é assumida, pois nem sempre é retornada pelo fluxo de Direct Post.

## Referências oficiais

- [TikTok Content Posting API: Direct Post](https://developers.tiktok.com/doc/content-posting-api-get-started/)
- [TikTok for Developers](https://developers.tiktok.com/)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [YouTube `videos.insert`](https://developers.google.com/youtube/v3/docs/videos/insert)
