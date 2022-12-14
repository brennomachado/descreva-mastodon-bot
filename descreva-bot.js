require('dotenv').config();
const Mastodon = require('mastodon-api');
const fs = require('fs');
const request = require('request');
const { info } = require('console');

//Não me pergunte, vou negar 👀
let count = 0,
  id = '',
  acct = '',
  content = '',
  today,
  date,
  time;

const info_toot = {
  cw: null,
  sensitve: null,
  texto_cw: '',
  url: '',
  texto_original: '',
  debug: false,
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
    today = new Date();
    date = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
    time = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`;
    count++;
    console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
    console.log(`INICIO STREAM ${count} - DT/HORA: ${date} - ${time}`);
    console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n\n`);
    // Para baixar e ver a organização do json
    // fs.writeFileSync(
    //   `TESTE-DATA${new Date().getTime()}.json`,
    //   JSON.stringify(response, null, 2)
    // );
    console.log(`RESPONSE.CONTENT:\n\t${response.data.status.content}`);
    id = response.data.status.id;
    acct = response.data.account.acct;
    content = response.data.status.content.match(/descri..o/im)
      ? response.data.status.content
          .replace(/<p>>?/gm, '\n\n')
          .replace(/<br>>?/gm, '\n')
          .replace(/<[^>]*>?/gm, '')
      : 0;

    console.log(`Content após captura e sem edição:\n\t ${content}`);
    const resposta_anterior = response.data.status.in_reply_to_id;

    if (content != 0) {
      //Tratando as palavras chaves da descrição enviada
      info_toot.debug = content.match(/#debug/im) ? true : false;
      console.log(`info_too.debug: ${info_toot.debug}`);
      content = content.replace(/#cw/im, '#cw');
      content = content.replace(/#oculta/im, '#oculta');
      content = content.replace(/#descri..o/im, '#descricao');
      content = content.replace(/#debug/im, '');

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

      //Logs ¯\_(ツ)_/¯
      console.log(
        `CONTENT após edição:\n\t${content}\nCW:${info_toot.texto_cw}`
      );
      console.log(`REPLY ID: \n ${resposta_anterior}`);
      console.log(
        `No Stream: Acct ${acct} - \nID: ${id}\nCW: ${info_toot.texto_cw}`
      );
      console.log(`Chamando dados()`);
    }
    dados(acct, id, content, resposta_anterior);
  }
});

//Função para fazer Get e postar resposta caso não siga o padrão do bot
async function dados(acct, reply_id, content, anterior_id) {
  console.log(`Dentro da DADOS`);
  console.log(`Acct ${acct}, reply_id: ${reply_id} content: ${content}\n`);

  //Se não tiver Descrição ou não for resposta a um toot, erro
  if (content === 0 || anterior_id === null) {
    console.log(`REPLY NÃO VÁLIDO\n`);
    const params = {
      status: `@${acct} COMO FUNCIONA:\n\n1. Clique e abra o toot que você quer por descrição na imagem;\n2. Marque este perfil no toot: @descreva@botsin.space;\n3. Adicione a hashtag #Descrição em seguida escreva sua Descrição\n\nApós a sua descrição você pode adicionar a tag #CW e em seguida adicionar um título para o CW.\n\nEste bot ainda está em teste, qualquer coisa me dê um toque (contato na descrição do perfil).`,
      in_reply_to_id: reply_id,
      visibility: 'direct',
    };
    M.post('statuses', params);

    today = new Date();
    date = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
    time = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`;
    console.log(`-------------------------------------------------`);
    console.log(`FIM DA VEZ ${count} - DT/HORA: ${date} - ${time}`);
    console.log(`-------------------------------------------------\n\n`);
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
      console.log(`Acct ${acct}, reply_id: ${reply_id} content: ${content}\n`);
      if (error) {
        console.log(error);
      } else {
        // fs.writeFileSync(
        //   `TESTE_IMAGETAG${new Date().getTime()}.json`,
        //   JSON.stringify(data, null, 2)
        // );
        console.log(`Content original: ${data.content}\n`);
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
          info_toot.texto_original = data.content
            .replace(/<p>>?/gm, '\n\n')
            .replace(/<br>>?/gm, '\n')
            .replace(/<[^>]*>?/gm, '');
          info_toot.url = data.url;
          url = data.media_attachments[0].remote_url;
          const path = './imagem.png';
          console.log(`URL salva: ${url}\n}`);

          //Finalmente fazendo Download da imagem para repostar
          console.log(`Chamando Doownload`);
          download(url, path, () => {
            if (content != 0) {
              console.log(`Chamando toot()`);
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
    console.log(`IF do CW: ${info_toot.cw}, TEXTO CW: ${info_toot.texto_cw}`);
    tootParams.spoiler_text = info_toot.texto_cw;
    tootParams.sensitve = info_toot.sensitve;
  }
  console.log(`DEBUG ${info_toot.debug}`);
  if (info_toot.debug) {
    tootParams.visibility = 'direct';
  }

  // Fazendo o toot
  await M.post('statuses', tootParams);

  today = new Date();
  date = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
  time = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`;
  console.log(`-------------------------------------------------`);
  console.log(`FIM DA VEZ ${count} - DT/HORA: ${date} - ${time}`);
  console.log(`-------------------------------------------------\n\n`);

  //Novamente não me pergunte..., eu não fiz nada 👀
  id = '';
  acct = '';
  content = '';
  info_toot.cw = null;
  info_toot.sensitve = null;
  info_toot.texto_cw = '';
  info_toot.url = '';
  info_toot.texto_original = '';
  info_toot.debug = false;
  return {
    success: true,
  };
}
