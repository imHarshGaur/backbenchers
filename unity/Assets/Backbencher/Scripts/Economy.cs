using System;
using System.Collections.Generic;
using System.Linq;

namespace Backbencher
{
    [Serializable] public class Escrow { public int stake,pot;public List<string> players;public bool settled; }
    public static class Economy
    {
        public static Escrow Collect(Dictionary<string,int> wallets,IEnumerable<string> ids,int stake)
        {
            var players=ids.ToList();GameRules.Require(stake>=0&&stake<=10000,"Invalid stake.");GameRules.Require(players.Count>=2&&players.Distinct().Count()==players.Count,"Invalid roster.");
            GameRules.Require(players.All(id=>wallets.ContainsKey(id)&&wallets[id]>=stake),"A player needs more Chalk Coins.");
            foreach(var id in players)wallets[id]-=stake;return new Escrow{stake=stake,pot=players.Count*stake,players=players};
        }
        public static void Settle(Dictionary<string,int> wallets,Escrow escrow,IEnumerable<string> winners)
        {
            var ids=winners.ToList();GameRules.Require(!escrow.settled,"Already settled.");GameRules.Require(ids.Distinct().Count()==ids.Count&&ids.All(escrow.players.Contains),"Invalid winners.");
            if(ids.Count==0)ids=escrow.players;GameRules.Require(ids.All(wallets.ContainsKey),"Missing wallet.");
            int each=escrow.pot/ids.Count,extra=escrow.pot%ids.Count;for(int i=0;i<ids.Count;i++)wallets[ids[i]]+=each+(i<extra?1:0);escrow.settled=true;
        }
    }
}
