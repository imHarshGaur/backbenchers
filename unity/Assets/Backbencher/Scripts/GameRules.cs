using System;
using System.Linq;
using System.Collections.Generic;

namespace Backbencher
{
    public static class GameRules
    {
        public static readonly string[] Colors={"#205eab","#b8433e","#338477","#a87517","#7b5294","#cf7343"};
        public static void Require(bool ok,string message){if(!ok)throw new InvalidOperationException(message);}
        public static double Clamp(double v,double min,double max)=>Math.Max(min,Math.Min(max,v));
        public static GameState Create(string kind,IList<string> names,Random random=null,string[] classes=null,int rounds=5)
        {
            Require(names.Count>=2&&names.Count<=6,"Use 2–6 players.");
            var s=new GameState{kind=kind,phase="playing",rounds=rounds};
            for(int i=0;i<names.Count;i++)s.players.Add(new PlayerState{id=i.ToString(),name=string.IsNullOrWhiteSpace(names[i])?"Benchmate "+(i+1):names[i].Substring(0,Math.Min(20,names[i].Length)),color=Colors[i]});
            var rng=random??new Random();
            if(kind=="pen")PenRocketRules.Initialize(s,classes);
            else if(kind=="dots")DotsRules.Initialize(s,rng);
            else if(kind=="rmcs")RmcsRules.Deal(s,rng);
            else throw new ArgumentException("Unknown game.");
            return s;
        }
        public static string Actor(GameState s)
        {
            if(s.kind!="rmcs")return s.players[s.turn].id;
            return s.phase=="reveal"?s.players[s.revealIndex].id:s.players[Array.IndexOf(s.roles,"Mantri")].id;
        }
        public static void CheckTurn(GameState s,string id){Require(s.phase=="playing"&&Actor(s)==id,"Wait for your turn.");}
        public static void Apply(GameState s,string id,GameAction a)
        {
            Require(a!=null,"Invalid action.");
            if(s.kind=="pen"&&a.type=="flick")PenRocketRules.Flick(s,id,a.dx,a.dy);
            else if(s.kind=="dots"&&a.type=="edge")DotsRules.Draw(s,id,a.key);
            else if(s.kind=="rmcs")
            {
                if(a.type=="reveal")RmcsRules.Reveal(s,id);
                else if(a.type=="guess")RmcsRules.Guess(s,id,a.target);
                else if(a.type=="swap")RmcsRules.Swap(s,id,a.target);
                else if(a.type=="bet")RmcsRules.Bet(s,id,a.caught);
                else throw new ArgumentException("Unknown chit action.");
            }
            else throw new ArgumentException("Unknown game action.");
        }
        public static void ScoreWinners(GameState s){int max=s.players.Max(p=>p.score);s.winners=s.players.Where(p=>p.score==max).Select(p=>p.id).ToList();}
    }
    public static class Geometry
    {
        static double Cross(Point a,Point b,Point c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
        static bool On(Point a,Point b,Point c)=>Math.Min(a.x,b.x)-1e-8<=c.x&&c.x<=Math.Max(a.x,b.x)+1e-8&&Math.Min(a.y,b.y)-1e-8<=c.y&&c.y<=Math.Max(a.y,b.y)+1e-8;
        public static bool Intersects(Point a,Point b,Point c,Point d)
        {
            double x=Cross(a,b,c),y=Cross(a,b,d),u=Cross(c,d,a),v=Cross(c,d,b);
            return (x*y < -1e-8&&u*v < -1e-8)||(Math.Abs(x)<1e-8&&On(a,b,c))||(Math.Abs(y)<1e-8&&On(a,b,d))||(Math.Abs(u)<1e-8&&On(c,d,a))||(Math.Abs(v)<1e-8&&On(c,d,b));
        }
    }
    public static class PenRocketRules
    {
        public static void Initialize(GameState s,string[] classes)
        {
            s.last="Pull back from your pen. Release to flick.";
            s.hazards.AddRange(new[]{new Hazard{kind="coffee",x=300,y=255,r=38},new Hazard{kind="portal",x=155,y=380,r=18},new Hazard{kind="portal",x=445,y=200,r=18},new Hazard{kind="shield",x=300,y=410,r=18}});
            for(int i=0;i<s.players.Count;i++)
            {
                double a=2*Math.PI*i/s.players.Count-Math.PI/2,x=300+205*Math.Cos(a),y=300+205*Math.Sin(a);
                string type=classes!=null&&i<classes.Length?classes[i]:"ballpoint";
                if(type!="gel"&&type!="fountain")type="ballpoint";
                var p=new PenState{id=i.ToString(),x=x,y=y,type=type,lives=(s.players.Count>=4?2:1)+(type=="fountain"?1:0)};
                p.segments.Add(new Segment(new Point(x-12,y+18),new Point(x,y)));s.pens.Add(p);
            }
        }
        public static void Flick(GameState s,string id,double dx,double dy)
        {
            GameRules.CheckTurn(s,id);GameRules.Require(!double.IsNaN(dx)&&!double.IsInfinity(dx)&&!double.IsNaN(dy)&&!double.IsInfinity(dy),"Invalid flick.");
            double power=Math.Sqrt(dx*dx+dy*dy);GameRules.Require(power>=4,"Pull farther.");
            var p=s.pens[s.turn];double distance=GameRules.Clamp(power,15,140)*(p.type=="gel"?3.2:p.type=="fountain"?1.85:2.65),angle=Math.Atan2(dy,dx);
            int steps=(int)Math.Ceiling(distance/5);double stride=distance/steps;bool teleported=false,coffee=false;var hit=new HashSet<string>();
            for(int i=0;i<steps&&p.alive;i++)
            {
                if(p.type=="gel")angle+=.0025;
                var a=new Point(p.x,p.y);var b=new Point(GameRules.Clamp(p.x+Math.Cos(angle)*stride,8,592),GameRules.Clamp(p.y+Math.Sin(angle)*stride,8,592));
                p.x=b.x;p.y=b.y;p.segments.Add(new Segment(a,b));
                foreach(var enemy in s.pens.Where(v=>v.id!=id&&v.alive&&!hit.Contains(v.id)))
                    if(enemy.segments.Any(seg=>Geometry.Intersects(a,b,seg.a,seg.b)))
                    {hit.Add(enemy.id);if(enemy.shield)enemy.shield=false;else {enemy.lives--;if(enemy.lives<=0)enemy.alive=false;}}
                foreach(var h in s.hazards)if(Point.Distance(new Point(p.x,p.y),new Point(h.x,h.y))<h.r)
                {
                    if(h.kind=="coffee"&&!coffee){angle+=Math.PI/2;coffee=true;}
                    if(h.kind=="shield"&&!h.used){p.shield=true;h.used=true;}
                    if(h.kind=="portal"&&!teleported){var t=s.hazards.First(v=>v.kind=="portal"&&v!=h);p.x=t.x+Math.Cos(angle)*(t.r+7);p.y=t.y+Math.Sin(angle)*(t.r+7);teleported=true;}
                }
                if(b.x<=8||b.x>=592||b.y<=8||b.y>=592)break;
            }
            s.turns++;
            if(s.turns%3==0){s.margin=Math.Min(285,s.margin+16);foreach(var v in s.pens)if(v.x<s.margin||v.x>600-s.margin||v.y<s.margin||v.y>600-s.margin)v.alive=false;}
            var alive=s.pens.Where(v=>v.alive).ToList();s.last=hit.Count>0?"Ink sliced!":"Ink down. Pass the pen.";
            if(alive.Count<=1){s.phase="finished";s.winners=alive.Select(v=>v.id).ToList();s.last=alive.Count>0?"Last pen standing!":"Red margin cleared the desk. Refund!";}
            else for(int i=1;i<=s.players.Count;i++){int n=(s.turn+i)%s.players.Count;if(s.pens[n].alive){s.turn=n;break;}}
        }
    }
    public static class DotsRules
    {
        public static void Initialize(GameState s,Random rng){s.size=s.players.Count==2?4:6;s.star=rng.Next((s.size-1)*(s.size-1));s.bomb=(s.star+(int)Math.Ceiling((s.size-1)*(s.size-1)/2.0))%((s.size-1)*(s.size-1));s.last="Close a box for a bonus turn.";}
        public static string[] BoxEdges(int x,int y)=>new[]{"h:"+x+":"+y,"h:"+x+":"+(y+1),"v:"+x+":"+y,"v:"+(x+1)+":"+y};
        public static List<string> AllEdges(GameState s){var list=new List<string>();for(int y=0;y<s.size;y++)for(int x=0;x<s.size;x++){if(x<s.size-1)list.Add("h:"+x+":"+y);if(y<s.size-1)list.Add("v:"+x+":"+y);}return list;}
        public static void Draw(GameState s,string id,string key)
        {
            GameRules.CheckTurn(s,id);GameRules.Require(AllEdges(s).Contains(key)&&!s.edges.ContainsKey(key),"Choose an empty edge.");s.edges[key]=id;
            int claimed=0;bool blast=false;
            for(int y=0;y<s.size-1;y++)for(int x=0;x<s.size-1;x++)
            {
                int k=y*(s.size-1)+x;
                if(!s.boxes.ContainsKey(k)&&BoxEdges(x,y).All(e=>s.edges.ContainsKey(e)))
                {s.boxes[k]=id;s.players[s.turn].score+=k==s.star?2:1;claimed++;if(k==s.bomb&&!s.bombUsed)blast=true;}
            }
            if(blast)
            {
                s.bombUsed=true;int bx=s.bomb%(s.size-1),by=s.bomb/(s.size-1);var protect=new HashSet<string>();
                foreach(int k in s.boxes.Keys)foreach(string e in BoxEdges(k%(s.size-1),k/(s.size-1)))protect.Add(e);
                foreach(var p in new[]{new Point(bx-1,by),new Point(bx+1,by),new Point(bx,by-1),new Point(bx,by+1)})
                    if(p.x>=0&&p.y>=0&&p.x<s.size-1&&p.y<s.size-1)foreach(string e in BoxEdges((int)p.x,(int)p.y))if(!protect.Contains(e))s.edges.Remove(e);
            }
            s.last=blast?"Ink bomb! Unclaimed lines washed away.":claimed>0?"Box claimed. Go again!":"Next benchmate, your line.";
            if(s.boxes.Count==(s.size-1)*(s.size-1)){s.phase="finished";GameRules.ScoreWinners(s);}else if(claimed==0)s.turn=(s.turn+1)%s.players.Count;
        }
    }
    public static class RmcsRules
    {
        public static readonly Dictionary<string,int> Points=new Dictionary<string,int>{{"Raja",1000},{"Mantri",800},{"Sipahi",500},{"Chor",0},{"Senapati",650},{"Daroga",400},{"Joker",250}};
        public static void Deal(GameState s,Random rng)
        {
            GameRules.Require(s.players.Count>=4&&s.players.Count<=6,"Chits needs 4–6 players.");GameRules.Require(s.rounds==5||s.rounds==7,"Choose 5 or 7 rounds.");
            var roles=new List<string>{"Raja","Mantri","Sipahi","Chor"};if(s.players.Count==5)roles.Add("Senapati");if(s.players.Count==6)roles.AddRange(new[]{"Daroga","Joker"});
            for(int i=roles.Count-1;i>0;i--){int j=rng.Next(i+1);string r=roles[i];roles[i]=roles[j];roles[j]=r;}
            s.roles=roles.ToArray();s.phase="reveal";s.revealIndex=0;s.guess=null;s.roundScores=null;s.bets.Clear();s.swapped=false;s.last="Pass privately. Only open your own chit.";
        }
        public static void Reveal(GameState s,string id){GameRules.Require(s.phase=="reveal"&&GameRules.Actor(s)==id,"Pass to the named player.");if(++s.revealIndex==s.players.Count){s.phase="guess";s.last="Mera Mantri Kaun? Find the Chor!";}}
        static int Index(GameState s,string id)=>s.players.FindIndex(p=>p.id==id);
        public static void Swap(GameState s,string id,string target)
        {
            int i=Index(s,id),j=Index(s,target);
            GameRules.Require(s.phase=="guess"&&!s.swapUsed&&i>=0&&s.roles[i]=="Chor","Chit swap unavailable.");
            GameRules.Require(j>=0&&j!=i&&s.roles[j]!="Raja"&&s.roles[j]!="Mantri","Choose an unrevealed player.");
            string r=s.roles[i];s.roles[i]=s.roles[j];s.roles[j]=r;s.swapUsed=true;s.swapped=true;s.last="A chit swap happened. Read the table!";
        }
        public static void Bet(GameState s,string id,bool caught){GameRules.Require(s.phase=="guess"&&Index(s,id)>=0&&!s.bets.ContainsKey(id),"One Chalk Bet per round.");s.bets[id]=caught;}
        public static void Guess(GameState s,string id,string target)
        {
            int i=Index(s,id),j=Index(s,target);GameRules.Require(s.phase=="guess"&&i>=0&&s.roles[i]=="Mantri","Only Mantri can guess.");GameRules.Require(j>=0&&s.roles[j]!="Raja"&&s.roles[j]!="Mantri","Pick an unrevealed classmate.");
            bool caught=s.roles[j]=="Chor";s.guess=target;s.roundScores=s.roles.Select(r=>r=="Mantri"&&!caught?0:r=="Chor"&&!caught?800:Points[r]).ToArray();
            for(int k=0;k<s.players.Count;k++){var p=s.players[k];if(s.bets.ContainsKey(p.id))s.roundScores[k]+=s.bets[p.id]==caught?50:-50;p.score+=s.roundScores[k];}
            s.history.Add(new RoundResult{round=s.round,roles=(string[])s.roles.Clone(),scores=(int[])s.roundScores.Clone(),caught=caught});s.phase=s.round==s.rounds?"finished":"result";s.last=caught?"Pakda gaya! Mantri caught the Chor.":"Chor stole 800 points!";if(s.phase=="finished")GameRules.ScoreWinners(s);
        }
        public static void NextRound(GameState s,Random rng){GameRules.Require(s.phase=="result","Finish the round first.");s.round++;Deal(s,rng);}
    }
    public static class BotController
    {
        public static GameAction Choose(GameState s,Random rng)
        {
            if(s.kind=="dots")
            {
                string best=null;double score=double.MinValue;
                foreach(string e in DotsRules.AllEdges(s).Where(k=>!s.edges.ContainsKey(k)))
                {
                    double rank=rng.NextDouble();
                    for(int y=0;y<s.size-1;y++)for(int x=0;x<s.size-1;x++){int k=y*(s.size-1)+x;var edges=DotsRules.BoxEdges(x,y);if(s.boxes.ContainsKey(k)||!edges.Contains(e))continue;int n=edges.Count(a=>s.edges.ContainsKey(a));if(n==3)rank+=k==s.star?200:100;if(n==2)rank-=10;}
                    if(rank>score){score=rank;best=e;}
                }
                return new GameAction{type="edge",key=best};
            }
            if(s.kind=="pen")
            {
                var p=s.pens[s.turn];var enemy=s.pens.Where(v=>v.alive&&v.id!=p.id).OrderBy(v=>Point.Distance(new Point(p.x,p.y),new Point(v.x,v.y))).First();
                var seg=enemy.segments[enemy.segments.Count/2];double factor=p.type=="gel"?3.2:p.type=="fountain"?1.85:2.65;
                double dx=((seg.a.x+seg.b.x)/2-p.x)/factor,dy=((seg.a.y+seg.b.y)/2-p.y)/factor;
                dx=dx==0?5:dx;dy=dy==0?5:dy;double power=Math.Sqrt(dx*dx+dy*dy);if(power<4){dx*=5/power;dy*=5/power;}return new GameAction{type="flick",dx=dx,dy=dy};
            }
            if(s.phase=="reveal")return new GameAction{type="reveal"};
            var candidates=s.players.Where((p,i)=>s.roles[i]!="Raja"&&s.roles[i]!="Mantri").ToArray();
            return new GameAction{type="guess",target=candidates[rng.Next(candidates.Length)].id};
        }
    }
}
