using System;
using System.Collections.Generic;
using System.Linq;
using Backbencher;
class Program
{
    static int checks;
    static void Check(bool ok,string name){if(!ok)throw new Exception(name);checks++;}
    static void Main()
    {
        Check(Geometry.Intersects(new Point(0,0),new Point(10,10),new Point(0,10),new Point(10,0)),"crossing");
        Check(Geometry.Intersects(new Point(0,0),new Point(10,0),new Point(5,0),new Point(12,0)),"collinear overlap");
        Check(!Geometry.Intersects(new Point(0,0),new Point(2,0),new Point(3,0),new Point(4,0)),"separated");
        var pen=GameRules.Create("pen",new[]{"A","B"});pen.hazards.Clear();pen.pens[0].x=100;pen.pens[0].y=100;pen.pens[1].segments=new List<Segment>{new Segment(new Point(150,50),new Point(150,150))};
        PenRocketRules.Flick(pen,"0",40,0);Check(pen.phase=="finished"&&pen.winners.SequenceEqual(new[]{"0"}),"pen cut");
        var dots=GameRules.Create("dots",new[]{"A","B"});dots.star=0;
        foreach(var e in new[]{"h:0:0","v:0:0","h:0:1"})dots.edges[e]="1";
        DotsRules.Draw(dots,"0","v:1:0");Check(dots.players[0].score==2&&dots.turn==0,"star and extra turn");
        var rng=new Random(7);
        for(int n=2;n<=6;n++)
        {
            var s=GameRules.Create("dots",Enumerable.Range(0,n).Select(i=>i.ToString()).ToArray(),rng);int moves=0;
            while(s.phase!="finished"&&moves++<200)GameRules.Apply(s,GameRules.Actor(s),BotController.Choose(s,rng));
            Check(s.phase=="finished"&&s.players.Sum(p=>p.score)==(s.size-1)*(s.size-1)+1,"bot dots "+n);
        }
        for(int n=4;n<=6;n++){var s=GameRules.Create("rmcs",Enumerable.Range(0,n).Select(i=>i.ToString()).ToArray(),rng);Check(s.roles.Length==n&&s.roles.Distinct().Count()==n,"role count "+n);}
        var chits=GameRules.Create("rmcs",new[]{"A","B","C","D"});chits.roles=new[]{"Raja","Mantri","Sipahi","Chor"};chits.phase="guess";
        RmcsRules.Bet(chits,"2",false);RmcsRules.Guess(chits,"1","2");Check(chits.roundScores.SequenceEqual(new[]{1000,0,550,800}),"incorrect guess and bet");
        RmcsRules.NextRound(chits,rng);chits.roles=new[]{"Raja","Mantri","Sipahi","Chor"};chits.phase="guess";RmcsRules.Swap(chits,"3","2");Check(chits.roles[2]=="Chor"&&chits.swapUsed,"swap");
        RmcsRules.Guess(chits,"1","2");RmcsRules.NextRound(chits,rng);Check(chits.swapUsed,"swap remains used");
        var wallets=new Dictionary<string,int>{{"0",100},{"1",100},{"2",100}};var pot=Economy.Collect(wallets,new[]{"0","1","2"},5);Economy.Settle(wallets,pot,new[]{"0","1"});Check(wallets.Values.Sum()==300&&wallets["0"]==103,"pot conservation and remainder");
        bool rejected=false;try{Economy.Settle(wallets,pot,new[]{"0"});}catch(InvalidOperationException){rejected=true;}Check(rejected,"settlement replay");
        Console.WriteLine(checks+" C# rule checks passed.");
    }
}
