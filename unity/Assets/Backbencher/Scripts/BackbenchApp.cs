using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UnityEngine;

namespace Backbencher
{
    // A scene-independent development UI. Replace presentation without changing rule controllers.
    public sealed class BackbenchApp : MonoBehaviour
    {
        GameState game;RoomState room;Escrow pot;
        Dictionary<string,int> wallets=new Dictionary<string,int>();
        readonly System.Random rng=new System.Random();
        NetworkSyncManager network;
        string screen="home",kind="pen",message="",you,roomCode="",serverUrl="ws://localhost:3000/ws",playerName="Benchmate",penClass="ballpoint";
        string[] names=Enumerable.Range(1,6).Select(i=>"Benchmate "+i).ToArray();
        int count=2,bots=1,stake=50,rounds=5,coins,streak,privateIndex=-1;
        bool online,opened,privateDeal,dragging;
        double deadline,botAt;Point dragEnd;
        Vector2 scroll;
        Action afterHello;
        AudioSource source;
        AudioClip scratch;
        GUIStyle title,label,button,note;
        readonly Color green=new Color(.16f,.31f,.27f),paper=new Color(.96f,.94f,.89f);
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Bootstrap(){if(FindFirstObjectByType<BackbenchApp>()==null)new GameObject("BACKBENCHER").AddComponent<BackbenchApp>();}
        void Awake()
        {
            Application.targetFrameRate=60;Screen.orientation=ScreenOrientation.Portrait;
            coins=PlayerPrefs.GetInt("chalk",1000);streak=PlayerPrefs.GetInt("streak",0);penClass=PlayerPrefs.GetString("pen","ballpoint");
            network=gameObject.AddComponent<NetworkSyncManager>();network.Received+=OnServer;network.Failed+=error=>message=error;
            source=gameObject.AddComponent<AudioSource>();scratch=AudioClip.Create("Pen scratch",4410,1,44100,false);var data=new float[4410];for(int i=0;i<data.Length;i++)data[i]=(float)(Math.Sin(i*.03)*.12*(1-(double)i/data.Length));scratch.SetData(data,0);
        }
        void Save(){PlayerPrefs.SetInt("chalk",coins);PlayerPrefs.SetInt("streak",streak);PlayerPrefs.SetString("pen",penClass);PlayerPrefs.Save();}
        void Feedback(){source.PlayOneShot(scratch);if(Application.isMobilePlatform)Handheld.Vibrate();}
        void Safe(Action action){try{action();}catch(Exception e){message=e.Message;}}
        async void Send(object value){try{await network.Send(value);}catch(Exception e){message=e.Message;}}
        async void Connect(Action ready)
        {
            if(network.Connected){ready?.Invoke();return;}afterHello=ready;
            try{await network.Connect(serverUrl,PlayerPrefs.GetString("session",null));}catch(Exception e){message=e.Message;afterHello=null;}
        }
        void OnServer(ServerMessage m)
        {
            if(m.type=="session"){PlayerPrefs.SetString("session",m.token);var callback=afterHello;afterHello=null;callback?.Invoke();}
            if(m.type=="state"){online=true;room=m.room;game=m.game;you=m.you;kind=room.kind;screen=game==null?"lobby":"play";deadline=(room.deadline-DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())/1000.0+Time.unscaledTimeAsDouble;if(privateIndex>=0&&game!=null&&game.phase!="guess"&&game.phase!="reveal")privateIndex=-1;EnsurePrivacy();}
            if(m.type=="left"){online=false;room=null;game=null;screen="home";}
        }
        bool IsBot(string id)=>!online&&int.Parse(id)>=count-bots;
        string Actor()=>GameRules.Actor(game);
        void Clock(){deadline=Time.unscaledTimeAsDouble+(game.kind=="dots"?6:game.kind=="rmcs"&&game.phase=="guess"?15:30);botAt=Time.unscaledTimeAsDouble+1.05;}
        void StartLocal(bool twice=false)
        {
            int nextStake=twice?checked(stake*2):stake;
            var nextPot=Economy.Collect(wallets,Enumerable.Range(0,count).Select(i=>i.ToString()),nextStake);stake=nextStake;
            pot=nextPot;coins=wallets["0"];Save();game=GameRules.Create(kind,names.Take(count).ToArray(),rng,Enumerable.Range(0,count).Select(i=>i==0?penClass:"ballpoint").ToArray(),rounds);online=false;screen="play";Clock();EnsurePrivacy();
        }
        void Apply(GameAction action,string id=null)
        {
            Safe(()=>
            {
                if(online){Send(new{type="action",version=room.version,action});return;}
                GameRules.Apply(game,id??Actor(),action);Feedback();
                if(action.type!="swap"&&action.type!="bet")Clock();
                if(game.phase=="finished"&&!pot.settled){Economy.Settle(wallets,pot,game.winners);coins=wallets["0"];streak=game.winners.Contains("0")?streak+1:0;Save();}EnsurePrivacy();
            });
        }
        void EnsurePrivacy()
        {
            if(game?.kind=="rmcs"&&game.phase=="reveal"&&privateIndex<0&&!IsBot(Actor())&&(!online||Actor()==you)){privateIndex=int.Parse(Actor());privateDeal=true;opened=false;}
        }
        void Update()
        {
            if(screen!="play"||game==null||online||game.phase=="finished"||game.phase=="result")return;
            if(privateIndex>=0){deadline+=Time.unscaledDeltaTime;botAt+=Time.unscaledDeltaTime;return;}
            if(IsBot(Actor())&&Time.unscaledTimeAsDouble>=botAt||Time.unscaledTimeAsDouble>=deadline)Apply(BotController.Choose(game,rng));
        }
        void OnApplicationPause(bool paused){if(paused)opened=false;}
        bool Btn(string text,Action click){if(!GUILayout.Button(text,button,GUILayout.MinHeight(54)))return false;Safe(click);return true;}
        void Text(string text)=>GUILayout.Label(text,label);
        void Heading(string text)=>GUILayout.Label(text,title);
        void OnGUI()
        {
            float scale=Screen.width/720f;GUI.matrix=Matrix4x4.Scale(new Vector3(scale,scale,1));GUI.color=paper;GUI.DrawTexture(new Rect(0,0,720,Screen.height/scale),Texture2D.whiteTexture);GUI.color=Color.white;
            title=new GUIStyle(GUI.skin.label){fontSize=38,fontStyle=FontStyle.Bold,wordWrap=true,normal={textColor=green}};
            label=new GUIStyle(GUI.skin.label){fontSize=22,wordWrap=true,normal={textColor=green}};
            note=new GUIStyle(label){fontSize=18};button=new GUIStyle(GUI.skin.button){fontSize=22,wordWrap=true,padding=new RectOffset(16,16,10,10)};
            if(privateIndex>=0){DrawPrivacy();return;}
            GUILayout.BeginArea(new Rect(28,20,664,Screen.height/scale-40));scroll=GUILayout.BeginScrollView(scroll);
            GUILayout.Label("BACKBENCHER     |     "+coins+" Chalk Coins",note);GUILayout.Space(20);
            if(screen=="home")Home();else if(screen=="setup")Setup();else if(screen=="lobby")Lobby();else if(screen=="locker")Locker();else Play();
            GUILayout.Space(16);GUILayout.Label(message,note);GUILayout.Space(30);GUILayout.EndScrollView();GUILayout.EndArea();
        }
        void Home()
        {
            Heading("Last bench.\nFirst place.");Text("The games we played when the teacher wasn’t looking.");GUILayout.Space(24);
            foreach(var k in new[]{"pen","dots","rmcs"}){string selected=k;Btn(k=="pen"?"PEN ROCKET  /  Flick. Slice. Survive.":k=="dots"?"CHAUKADI BLITZ  /  Close one more box.":"RAJA MANTRI CHOR  /  Trust no one.",()=>{kind=selected;count=kind=="rmcs"?4:2;bots=count-1;screen="setup";});}
            GUILayout.Space(20);Btn("Open daily tiffin  +100",()=>{string today=DateTime.Now.ToString("yyyy-MM-dd");GameRules.Require(PlayerPrefs.GetString("daily")!=today,"Tiffin already claimed today.");coins+=100;PlayerPrefs.SetString("daily",today);Save();Feedback();});Btn("Stationery locker",()=>screen="locker");Text("Play-money coins only. No purchases or cash-outs.");
        }
        void Locker()
        {
            Heading("Stationery locker");foreach(var k in new[]{"ballpoint","gel","fountain"}){string selected=k;int cost=k=="gel"?200:k=="fountain"?300:0;bool owned=k=="ballpoint"||PlayerPrefs.GetInt("unlock."+k)==1;Btn(k+(penClass==k?" / Equipped":owned?" / Equip":" / Unlock "+cost),()=>{if(!owned){GameRules.Require(coins>=cost,"Not enough coins.");coins-=cost;PlayerPrefs.SetInt("unlock."+selected,1);}penClass=selected;Save();});}Btn("Back to desk",()=>screen="home");
        }
        void Setup()
        {
            Heading(kind=="pen"?"Pen Rocket":kind=="dots"?"Chaukadi Blitz":"Raja Mantri Chor");online=GUILayout.Toggle(online," Online room",label,GUILayout.Height(40));
            if(online)
            {
                Text("WebSocket server URL (use wss:// in production)");serverUrl=GUILayout.TextField(serverUrl,label,GUILayout.Height(42));Text("Your name");playerName=GUILayout.TextField(playerName,20,label,GUILayout.Height(42));Text("Room code");roomCode=GUILayout.TextField(roomCode,4,label,GUILayout.Height(42));
                Btn("Create classroom / 50 coins",()=>Connect(()=>Send(new{type="create",kind,stake=50,name=playerName,penClass})));
                Btn("Join classroom",()=>Connect(()=>Send(new{type="join",code=roomCode.ToUpperInvariant(),name=playerName,penClass})));
                Btn("Reconnect current classroom",()=>Connect(null));
            }
            else
            {
                Text("Benchmates: "+count);count=(int)GUILayout.HorizontalSlider(count,kind=="rmcs"?4:2,6,GUILayout.Height(30));bots=Math.Min(bots,count-1);Text("Bot seats: "+bots);bots=(int)GUILayout.HorizontalSlider(bots,0,count-1,GUILayout.Height(30));
                for(int i=0;i<count-bots;i++)names[i]=GUILayout.TextField(names[i],20,label,GUILayout.Height(42));
                for(int i=count-bots;i<count;i++)names[i]="Bench Bot "+(i+1);
                stake=GUILayout.Toggle(stake>0," Stake 50 Chalk Coins each",label,GUILayout.Height(45))?50:0;
                if(kind=="rmcs")rounds=GUILayout.Toggle(rounds==7," Seven rounds (default: five)",label,GUILayout.Height(45))?7:5;
                Btn("Let’s play",()=>{wallets=Enumerable.Range(0,count).ToDictionary(i=>i.ToString(),i=>i==0?coins:1000);StartLocal();});
            }
            Btn("Back to desk",()=>{online=false;screen="home";});
        }
        void Lobby()
        {
            Heading("Classroom "+room.code);foreach(var p in room.players)Text(p.name+(p.bot?" / BOT":"")+(p.ready?" / Ready":" / Waiting"));Text(room.stake+" coins each / Your room wallet: "+room.wallets[you]);
            Btn("Toggle ready",()=>Send(new{type="ready",ready=!room.players.First(p=>p.id==you).ready}));
            if(room.host==you){Btn("Add bots",()=>Send(new{type="bots",count=kind=="rmcs"?4:Math.Min(6,room.players.Count+1)}));Btn("Start match",()=>Send(new{type="start"}));if(game!=null)Btn("Double stakes rematch",()=>Send(new{type="start",@double=true}));}
            Btn("Leave room",()=>Send(new{type="leave"}));
        }
        void Play()
        {
            if(game==null)return;Heading(game.kind=="pen"?"Pen Rocket":game.kind=="dots"?"Chaukadi Blitz":"Raja Mantri Chor");Text(game.last);
            if(game.phase=="finished")
            {
                Heading(game.winners.Count==0?"Stakes refunded":string.Join(" & ",game.players.Where(p=>game.winners.Contains(p.id)).Select(p=>p.name))+" wins!");
                if(online)Btn("Rematch lobby",()=>screen="lobby");else{Btn("Play again",()=>StartLocal());Btn("Double stakes",()=>StartLocal(true));}
            }
            else if(game.phase=="result")Btn("Next round",()=>{if(online)Send(new{type="next"});else{RmcsRules.NextRound(game,rng);Clock();EnsurePrivacy();}});
            else Text("Turn: "+game.players.First(p=>p.id==Actor()).name+"  /  "+Math.Max(0,(int)Math.Ceiling(deadline-Time.unscaledTimeAsDouble))+"s");
            Text("Pot: "+(online?room.pot:pot.pot)+" coins"+(game.kind=="rmcs"?" / Round "+game.round+" of "+game.rounds:""));
            if(game.kind=="rmcs")Chits();else{Rect rect=GUILayoutUtility.GetRect(600,600,GUILayout.Width(600),GUILayout.Height(600));Board(rect);}
            foreach(var p in game.players)Text(p.name+": "+(game.kind=="pen"?(game.pens[int.Parse(p.id)].alive?game.pens[int.Parse(p.id)].lives+" lives":"OUT"):p.score+" pts"));
            if(!online)Btn("Back to desk (refund unfinished match)",()=>{if(!pot.settled){Economy.Settle(wallets,pot,new string[0]);coins=wallets["0"];Save();}game=null;screen="home";privateIndex=-1;});
            else if(!network.Connected)Btn("Reconnect",()=>Connect(null));
        }
        void Chits()
        {
            bool resolved=game.phase=="result"||game.phase=="finished";
            for(int i=0;i<game.players.Count;i++)
            {
                int index=i;string r=game.roles[i];bool visible=resolved||game.phase=="guess"&&(r=="Raja"||r=="Mantri");
                GUI.enabled=game.phase=="guess"&&(!online||Actor()==you)&&r!="Raja"&&r!="Mantri";
                Btn(game.players[i].name+"  /  "+(visible?r:"Folded chit"),()=>Apply(new GameAction{type="guess",target=index.ToString()}));GUI.enabled=true;
            }
            if(game.phase=="guess")foreach(var p in game.players.Where(p=>online?p.id==you:!IsBot(p.id)))
            {string id=p.id;Btn("Private chit / "+p.name,()=>{privateIndex=int.Parse(id);privateDeal=false;opened=false;});}
        }
        void DrawPrivacy()
        {
            GUILayout.BeginArea(new Rect(48,80,624,Screen.height/(Screen.width/720f)-120));Heading("Pass to "+game.players[privateIndex].name);Text("Everyone else, look away.");GUILayout.Space(28);
            if(!opened)Btn("Open my chit",()=>opened=true);
            else
            {
                string role=online?game.myRole:game.roles[privateIndex];Heading(role);Text(RmcsRules.Points[role]+" points. Keep it secret.");
                if(!privateDeal&&game.phase=="guess")
                {
                    if(role=="Chor"&&!game.swapUsed)foreach(var p in game.players.Where((p,i)=>i!=privateIndex&&game.roles[i]!="Raja"&&game.roles[i]!="Mantri"))
                    {string target=p.id;Btn("Swap with "+p.name,()=>{string id=privateIndex.ToString();privateIndex=-1;Apply(new GameAction{type="swap",target=target},id);});if(privateIndex<0)break;}
                    if(privateIndex>=0&&!game.bets.ContainsKey(privateIndex.ToString()))
                    {Btn("Chalk Bet: caught (+/- 50 pts)",()=>PrivateBet(true));if(privateIndex>=0)Btn("Chalk Bet: escapes (+/- 50 pts)",()=>PrivateBet(false));}
                }
                if(privateIndex>=0)Btn("Fold and pass",()=>{string id=privateIndex.ToString();privateIndex=-1;if(privateDeal)Apply(new GameAction{type="reveal"},id);});
            }
            GUILayout.EndArea();
        }
        void PrivateBet(bool caught){string id=privateIndex.ToString();privateIndex=-1;Apply(new GameAction{type="bet",caught=caught},id);}
        static Color Parse(string hex){ColorUtility.TryParseHtmlString(hex,out Color c);return c;}
        static void Fill(Rect rect,Color c){GUI.color=c;GUI.DrawTexture(rect,Texture2D.whiteTexture);GUI.color=Color.white;}
        static void Line(Point a,Point b,Color c,float width=3)
        {
            var old=GUI.matrix;var start=new Vector2((float)a.x,(float)a.y);float length=Vector2.Distance(start,new Vector2((float)b.x,(float)b.y));GUIUtility.RotateAroundPivot((float)(Math.Atan2(b.y-a.y,b.x-a.x)*180/Math.PI),start);Fill(new Rect(start.x,start.y-width/2,length,width),c);GUI.matrix=old;
        }
        void Board(Rect rect)
        {
            GUI.BeginGroup(rect);Fill(new Rect(0,0,600,600),new Color(1,.99f,.95f));
            for(int y=30;y<600;y+=30)Line(new Point(0,y),new Point(600,y),new Color(.77f,.83f,.83f),1);
            if(game.kind=="pen")
            {
                int m=game.margin;Color danger=new Color(.75f,.3f,.2f,.12f);Fill(new Rect(0,0,600,m),danger);Fill(new Rect(0,600-m,600,m),danger);Fill(new Rect(0,m,m,600-2*m),danger);Fill(new Rect(600-m,m,m,600-2*m),danger);
                foreach(var h in game.hazards)if(!h.used)GUI.Label(new Rect((float)(h.x-h.r),(float)(h.y-h.r),(float)(h.r*2),(float)(h.r*2)),h.kind=="coffee"?"O":h.kind=="portal"?"@":"◇",title);
                foreach(var p in game.pens){Color c=Parse(game.players[int.Parse(p.id)].color);if(!p.alive)c.a=.15f;foreach(var seg in p.segments)Line(seg.a,seg.b,c,p.type=="fountain"?4:2.5f);Fill(new Rect((float)p.x-5,(float)p.y-22,10,28),c);GUI.Label(new Rect((float)p.x-45,(float)p.y+10,100,35),game.players[int.Parse(p.id)].name,note);}
                if(dragging){var p=game.pens[game.turn];Line(new Point(p.x,p.y),new Point(2*p.x-dragEnd.x,2*p.y-dragEnd.y),green,2);}
            }
            else
            {
                double step=460.0/(game.size-1);
                foreach(var box in game.boxes){int x=box.Key%(game.size-1),y=box.Key/(game.size-1);Color c=Parse(game.players[int.Parse(box.Value)].color);c.a=.2f;Fill(new Rect((float)(70+x*step),(float)(70+y*step),(float)step,(float)step),c);GUI.Label(new Rect((float)(70+x*step+step/3),(float)(70+y*step+step/3),50,50),game.players[int.Parse(box.Value)].name.Substring(0,1),title);}
                foreach(int k in new[]{game.star,game.bomb})if(!game.boxes.ContainsKey(k)&&!(k==game.bomb&&game.bombUsed))GUI.Label(new Rect((float)(70+(k%(game.size-1)+.4)*step),(float)(70+(k/(game.size-1)+.4)*step),50,50),k==game.star?"★":"*",title);
                foreach(var edge in game.edges){ParseEdge(edge.Key,step,out Point a,out Point b);Line(a,b,Parse(game.players[int.Parse(edge.Value)].color),5);}
                for(int y=0;y<game.size;y++)for(int x=0;x<game.size;x++)Fill(new Rect((float)(65+x*step),(float)(65+y*step),10,10),green);
            }
            var e=Event.current;var pos=e.mousePosition;
            if(game.phase=="playing"&&(!online||Actor()==you)&&!IsBot(Actor()))
            {
                if(e.type==EventType.MouseDown&&new Rect(0,0,600,600).Contains(pos))
                {
                    var p=new Point(pos.x,pos.y);
                    if(game.kind=="pen"){var pen=game.pens[game.turn];if(Point.Distance(p,new Point(pen.x,pen.y))<45){dragging=true;dragEnd=p;e.Use();}}
                    else
                    {
                        string best=null;double dist=30;
                        foreach(string key in DotsRules.AllEdges(game).Where(k=>!game.edges.ContainsKey(k))){ParseEdge(key,460.0/(game.size-1),out Point a,out Point b);double d=Point.Distance(p,new Point((a.x+b.x)/2,(a.y+b.y)/2));if(d<dist){dist=d;best=key;}}
                        if(best!=null){Apply(new GameAction{type="edge",key=best});e.Use();}
                    }
                }
                if(e.type==EventType.MouseDrag&&dragging){dragEnd=new Point(pos.x,pos.y);e.Use();}
                if(e.type==EventType.MouseUp&&dragging){var pen=game.pens[game.turn];dragging=false;Apply(new GameAction{type="flick",dx=pen.x-dragEnd.x,dy=pen.y-dragEnd.y});e.Use();}
            }
            GUI.EndGroup();
        }
        static void ParseEdge(string key,double step,out Point a,out Point b){var t=key.Split(':');a=new Point(70+int.Parse(t[1])*step,70+int.Parse(t[2])*step);b=new Point(a.x+(t[0]=="h"?step:0),a.y+(t[0]=="v"?step:0));}
    }
}
