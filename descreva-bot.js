require('dotenv').config();
const Mastodon = require('mastodon-api');
const fs = require('fs');
const request = require('request');

//Não me pergunte, vou negar 👀
let id = '';
let acct = '';
let content = '';
const info_toot = {
  cw: null,
  sensitve: null,
  texto_cw: '',
  url: '',
  texto_original: '',
};

//Função para download de imagem por url
const download = function (url, path, callback) {
  request.head(url, function (err, res, body) {
    // console.log('content-type:', res.headers['content-type']);
    // console.log('content-length:', res.headers['content-length']);
    request(url).pipe(fs.createWriteStream(path)).on('close', callback);
  });
};

//Conexão com API do Mastodon
console.log('Mastodon Bot starting...');
const M = new Mastodon({
  client_key: process.env.CLIENT_KEY,
  client_secret: process.env.CLIENT_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  timeout_ms: 60 * 1000,
  api_url: 'https://botsin.space/api/v1/',
});
const stream = M.stream('streaming/user');

// Ouvindo menções
stream.on('message', (response) => {
  if (response.event === 'notification' && response.data.type === 'mention') {
    console.log(`Dentro do Stream`);
    // Para baixar e ver a organização do json
    // fs.writeFileSync(
    //   `TESTE-DATA${new Date().getTime()}.json`,
    //   JSON.stringify(response, null, 2)
    // );
    id = response.data.status.id;
    acct = response.data.account.acct;
    content = response.data.status.content.match(/descri..o/im)
      ? response.data.status.content
          .replace(/<br>>?/gm, '\n')
          .replace(/<[^>]*>?/gm, '')
      : 0;

    console.log(`Content após captura: ${content}`);
    const resposta_anterior = response.data.status.in_reply_to_id;

    if (content != 0) {
      //Tratando as palavras chaves da descrição enviada
      content = content.replace(/#cw/im, '#cw');
      content = content.replace(/#oculta/im, '#oculta');
      content = content.replace(/#descri..o/im, '#descricao');

      //Fazendo a limpeza da descrição enviada e separando CW
      let post_item = 0;
      if (content.match(/#oculta/im)) {
        info_toot.sensitve = true;
        post_item = content.lastIndexOf('#oculta');
        content = content.slice(0, post_item).trim();
      }
      if (content.match(/#cw/im)) {
        info_toot.cw = true;
        post_item = content.lastIndexOf('#cw');
        info_toot.texto_cw = content
          .slice(post_item + 3, content.length)
          .trim();
        content = content.slice(0, post_item).trim();
      }
      content.replace(/#descri..o/im, '#descricao');
      post_item = content.lastIndexOf('#descri');
      content = content.slice(post_item + 10, content.length).trim();
    }

    //Logs ¯\_(ツ)_/¯
    console.log(
      `CONTENT: ${content}\nOriginal: ${response.data.status.content}\nCW:${info_toot.texto_cw}`
    );
    console.log(`REPLY ID: \n ${resposta_anterior}`);
    console.log(
      `No Stream: Acct ${acct} - \nid: ${id} \ncontent: ${content}\ncw: ${info_toot.texto_cw}`
    );
    console.log(`Chamando dados()`);
    dados(acct, id, content, resposta_anterior);
  }
});

//Função para fazer Get e postar resposta caso não siga o padrão do bot
async function dados(acct, reply_id, content, anterior_id) {
  console.log(`Dentro da DADOS - valor do content: ${content}`);
  console.log(`Acct ${acct}, reply_id: ${reply_id} content: ${content}`);

  //Se não tiver Descrição ou não for resposta a um toot, erro
  if (content === 0 || anterior_id === null) {
    const params = {
      status: `@${acct} COMO FUNCIONA:\n\n1. Clique e abra o toot que você quer por descrição na imagem;\n2. Marque este perfil no toot: @descreva@botsin.space;\n3. Adicione a hashtag #Descrição em seguida escreva sua Descrição\n\nApós a sua descrição você pode adicionar a tag #CW e em seguida adicionar um título para o CW.\n\nSe quiser só ocultar a mídia depois de descrever coloque a hashtag #oculta ao final de todo o texto.\n\nEste bot ainda está em teste, qualquer coisa me dê um toque.`,
      in_reply_to_id: reply_id,
      visibility: 'direct',
    };
    M.post('statuses', params);
    return {
      success: true,
    };
  } else {
    // Pegando informações do toot a ser copiado
    const replyParams = {
      id: anterior_id,
    };
    console.log(`Fazendo o M.GET \n`);
    await M.get('statuses/:id', replyParams, (error, data) => {
      console.log(`Dentro M.GET`);
      console.log(`Acct ${acct}, reply_id: ${reply_id} content: ${content}`);
      if (error) {
        console.log(error);
      } else {
        // fs.writeFileSync(
        //   `TESTE_IMAGETAG${new Date().getTime()}.json`,
        //   JSON.stringify(data, null, 2)
        // );
        console.log(`MEDIA LENGTH: ${data.media_attachments.length}`);
        if (!data.media_attachments.length) {
          return;
        } else {
          // Verificando CW e imagem sensível
          if (data.sensitve === true) {
            info_toot.sensitve = true;
          }
          if (!info_toot.cw) {
            info_toot.cw = true;
            info_toot.texto_cw = data.spoiler_text;
          }

          console.log(`URL: ${data.media_attachments[0].remote_url}`);

          info_toot.texto_original = data.content.replace(/<[^>]*>?/gm, '');
          info_toot.url = data.url;
          url = data.media_attachments[0].remote_url;
          const path = './imagem.png';
          console.log(`Chamando Doownload`);
          console.log(
            `Antes Acct ${acct}, reply_id: ${reply_id} content: ${content}`
          );

          //finalmente fazendo Download da imagem para repostar
          download(url, path, () => {
            if (content != 0) {
              console.log(
                `Chamando toot() - Acct ${acct}, reply_id: ${reply_id} content: ${content}`
              );
              toot(acct, reply_id, content);
              console.log('✅ Done!');
            }
          });
        }
      }
    });
  }
}

//Função que posta a o toot com a imagem com descrição
async function toot(acct, reply_id, content) {
  console.log(`Tentando pegar a imagem do PC`);
  const imagem = fs.createReadStream('./imagem.png');

  // Definindo parametros e upload da midia
  const uploadParams = {
    file: imagem,
    description: content,
  };
  const uploadResponse = await M.post('media', uploadParams);
  const mediaId = uploadResponse.data.id;

  // Parametros do toot com a imagem
  let tootParams = {
    status: `${info_toot.texto_original}\n\n🔗: ${info_toot.url}\ncc: @${acct} `,
    in_reply_to_id: reply_id,
    media_ids: [mediaId],
  };
  if (info_toot.cw) {
    console.log(`IF do CW: ${info_toot.cw} texto cw: ${info_toot.texto_cw}`);
    tootParams.spoiler_text = info_toot.texto_cw;
    tootParams.sensitve = info_toot.sensitve;
  }

  // Fazendo o toot
  await M.post('statuses', tootParams);

  //Novamente não me pergunte..., eu não fiz nada 👀
  id = '';
  acct = '';
  content = '';
  info_toot.cw = null;
  info_toot.sensitve = null;
  info_toot.texto_cw = '';
  info_toot.url = '';
  info_toot.texto_original = '';
  return {
    success: true,
  };
}
