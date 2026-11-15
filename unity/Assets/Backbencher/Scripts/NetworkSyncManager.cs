using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using UnityEngine;

namespace Backbencher
{
    // Server is the authority. TLS protects transport; hidden role arrays never reach peers.
    public sealed class NetworkSyncManager : MonoBehaviour
    {
        public event Action<ServerMessage> Received;
        public event Action<string> Failed;
        public string SessionToken {get;private set;}
        public bool Connected => socket?.State==WebSocketState.Open;
        ClientWebSocket socket;
        CancellationTokenSource lifetime;
        readonly SemaphoreSlim sendGate=new SemaphoreSlim(1,1);
        readonly ConcurrentQueue<ServerMessage> inbox=new ConcurrentQueue<ServerMessage>();
        readonly ConcurrentQueue<string> failures=new ConcurrentQueue<string>();
        public async Task Connect(string url,string resumeToken=null)
        {
            Disconnect();lifetime=new CancellationTokenSource();socket=new ClientWebSocket();
            var current=socket;var cancellation=lifetime.Token;
            await current.ConnectAsync(new Uri(url),cancellation);
            await Send(new {type="hello",token=resumeToken});
            _=ReceiveLoop(current,cancellation);
        }
        public async Task Send(object message)
        {
            if(!Connected)throw new InvalidOperationException("Room server is disconnected.");
            byte[] bytes=Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(message));
            var current=socket;var cancellation=lifetime.Token;
            await sendGate.WaitAsync(cancellation);
            try{await current.SendAsync(new ArraySegment<byte>(bytes),WebSocketMessageType.Text,true,cancellation);}
            finally{sendGate.Release();}
        }
        async Task ReceiveLoop(ClientWebSocket current,CancellationToken token)
        {
            var buffer=new byte[8192];
            try
            {
                while(current.State==WebSocketState.Open&&!token.IsCancellationRequested)
                {
                    using(var stream=new MemoryStream())
                    {
                        WebSocketReceiveResult result;
                        do
                        {
                            result=await current.ReceiveAsync(new ArraySegment<byte>(buffer),token);
                            if(result.MessageType==WebSocketMessageType.Close){failures.Enqueue("Room connection closed. Reconnect to resume.");return;}
                            stream.Write(buffer,0,result.Count);
                            if(stream.Length>4*1024*1024)throw new InvalidDataException("Room payload exceeds 4 MiB.");
                        }while(!result.EndOfMessage);
                        inbox.Enqueue(JsonConvert.DeserializeObject<ServerMessage>(Encoding.UTF8.GetString(stream.ToArray())));
                    }
                }
            }
            catch(OperationCanceledException){}
            catch(Exception e){if(!token.IsCancellationRequested)failures.Enqueue(e.Message);}
        }
        void Update()
        {
            while(inbox.TryDequeue(out var message))
            {
                if(message==null)continue;
                if(message.type=="session")SessionToken=message.token;
                if(message.type=="error")Failed?.Invoke(message.message);else Received?.Invoke(message);
            }
            while(failures.TryDequeue(out var error))Failed?.Invoke(error);
        }
        public void Disconnect(){lifetime?.Cancel();socket?.Dispose();lifetime?.Dispose();socket=null;lifetime=null;}
        void OnDestroy(){Disconnect();}
    }
}
