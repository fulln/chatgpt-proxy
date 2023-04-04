export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      if(url.pathname.includes("fulln")){
        // openai is already set all CORS heasders 
        return fetch("chat-gpt-fulln.vercel.app", {
          headers: request.headers,
          method: request.method,
          body: request.body,
          redirect: 'follow'
        });
      }else{
        url.host = "api.openai.com";
        // openai is already set all CORS heasders 
        return fetch(url, {
          headers: request.headers,
          method: request.method,
          body: request.body,
          redirect: 'follow'
        });
      }
    }
  }
  
