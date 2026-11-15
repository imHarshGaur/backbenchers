using System;
using System.Collections.Generic;

namespace Backbencher
{
    // Lowercase fields intentionally match shared/core.js JSON wire names.
    [Serializable] public struct Point
    {
        public double x, y;
        public Point(double x, double y) { this.x = x; this.y = y; }
        public static double Distance(Point a, Point b) => Math.Sqrt((a.x-b.x)*(a.x-b.x)+(a.y-b.y)*(a.y-b.y));
    }
    [Serializable] public class Segment { public Point a,b; public Segment(Point a,Point b){this.a=a;this.b=b;} }
    [Serializable] public class PlayerState { public string id,name,color; public int score; }
    [Serializable] public class PenState
    {
        public string id,type; public double x,y; public bool alive=true,shield; public int lives;
        public List<Segment> segments=new List<Segment>();
    }
    [Serializable] public class Hazard { public string kind; public double x,y,r; public bool used; }
    [Serializable] public class RoundResult { public int round; public string[] roles; public int[] scores; public bool caught; }
    [Serializable] public class GameState
    {
        public string kind,phase,last,myRole,guess;
        public List<PlayerState> players=new List<PlayerState>();
        public int turn,turns,margin=28,size,star,bomb,round=1,rounds=5,revealIndex;
        public bool bombUsed,swapUsed,swapped;
        public List<string> winners=new List<string>();
        public List<PenState> pens=new List<PenState>();
        public List<Hazard> hazards=new List<Hazard>();
        public Dictionary<string,string> edges=new Dictionary<string,string>();
        public Dictionary<int,string> boxes=new Dictionary<int,string>();
        public string[] roles;
        public int[] roundScores;
        public Dictionary<string,bool> bets=new Dictionary<string,bool>();
        public List<RoundResult> history=new List<RoundResult>();
    }
    [Serializable] public class GameAction { public string type,key,target; public double dx,dy; public bool caught; }
    [Serializable] public class LobbyPlayer { public string id,name; public bool ready,bot,connected; }
    [Serializable] public class RoomState
    {
        public string code,host,kind; public int stake,pot,version; public long deadline;
        public List<LobbyPlayer> players; public Dictionary<string,int> wallets;
    }
    [Serializable] public class ServerMessage
    {
        public string type,token,message,you; public RoomState room; public GameState game;
    }
}
