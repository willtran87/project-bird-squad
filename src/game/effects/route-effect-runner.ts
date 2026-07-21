import { alphaCacheSet } from '../runtime-data';
import type { RouteNode } from '../types';
import { parseEffect } from './effect-parser';

export interface RouteNextCombatMods {
  openSkyGuard?: number;
  reduceNextOpenSky?: number;
  enemyCover?: number;
  startOpenSky?: boolean;
  bossDamageShield?: number;
}

export interface RouteEffectCardRef {
  id: string;
  upgraded?: boolean;
}

export interface RouteEffectRunState {
  deck: RouteEffectCardRef[];
  currentHp: number;
  scrap: number;
  scrapEarned?: number;
  scrapSpent?: number;
  routeMarks: string[];
  supplies: string[];
  supplySlots?: number;
  completedRouteNodeIds: string[];
  routeLog: string[];
  nextCombat?: RouteNextCombatMods;
  freePreenNextDistrict?: number;
}

export interface RouteEffectContext {
  runState: RouteEffectRunState;
  currentMapNodes: () => RouteNode[];
  runMaxHp: () => number;
  runSupplyCapacity: (runState: Pick<RouteEffectRunState, 'supplySlots'>) => number;
  grantRouteMark: (selector: string) => void;
  grantSupply: (selector: string) => void;
  grantCard: (selector: string) => void;
  preenFirstAvailableCard: () => unknown;
  releaseFirstReleasable: (count: number) => void;
  random?: () => number;
}

export function checkRouteCondition(condition: string, context: Pick<RouteEffectContext, 'runState' | 'currentMapNodes'>) {
  const visitedType = /^visitedNodeType\(([a-zA-Z0-9_]+)\)$/.exec(condition);
  if (visitedType) {
    const wantedType = visitedType[1];
    return context.currentMapNodes().some((node) =>
      node.type === wantedType && context.runState.completedRouteNodeIds.includes(node.id)
    );
  }
  return false;
}

export function resolveRouteEffect(effect: string, context: RouteEffectContext) {
  const conditional = /^if (.+?) then (.+)$/.exec(effect);
  if (conditional) {
    if (checkRouteCondition(conditional[1], context)) resolveRouteEffect(conditional[2], context);
    return;
  }

  const parsed = parseEffect(effect);
  if (!parsed) return;

  const arg0 = parsed.args[0] ?? '';
  const n = Number(arg0);
  const max = context.runMaxHp();
  const rs = context.runState;
  const mod = (patch: RouteNextCombatMods) => { rs.nextCombat = { ...rs.nextCombat, ...patch }; };

  switch (parsed.name) {
    case 'gainScrap': {
      const gained = Math.max(0, n);
      rs.scrap += gained;
      rs.scrapEarned = (rs.scrapEarned ?? 0) + gained;
      break;
    }
    case 'payScrap': {
      const spent = Math.min(rs.scrap, Math.max(0, n));
      rs.scrap -= spent;
      rs.scrapSpent = (rs.scrapSpent ?? 0) + spent;
      break;
    }
    case 'loseCohesion': rs.currentHp = Math.max(0, rs.currentHp - n); break;
    case 'healCohesion': case 'heal': rs.currentHp = Math.min(max, rs.currentHp + n); break;
    case 'cleanseFlock': {
      const routeHeal = Math.min(max - rs.currentHp, Math.max(1, n || 1) * 2);
      if (routeHeal > 0) {
        rs.currentHp += routeHeal;
        rs.routeLog.push(`Clean feathers restore ${routeHeal} Cohesion on the route.`);
      } else {
        const guard = Math.max(1, n || 1);
        mod({ openSkyGuard: (rs.nextCombat?.openSkyGuard ?? 0) + guard });
        rs.routeLog.push(`Clean feathers pack ${guard} Open Sky Guard for the next fight.`);
      }
      break;
    }
    case 'healMissingPct': {
      const heal = Math.max(Number(parsed.args[1]) || 0, Math.round(((max - rs.currentHp) * n) / 100));
      rs.currentHp = Math.min(max, rs.currentHp + heal);
      break;
    }
    case 'gainRouteMark': context.grantRouteMark(arg0); break;
    case 'gainSupply': context.grantSupply(arg0); break;
    case 'gainSupplyChoice': context.grantSupply('random'); break;
    case 'peekNextNodes': {
      const plan = Math.max(1, n || 1);
      mod({
        openSkyGuard: (rs.nextCombat?.openSkyGuard ?? 0) + 1,
        reduceNextOpenSky: (rs.nextCombat?.reduceNextOpenSky ?? 0) + plan
      });
      rs.routeLog.push(`Route plan set: +1 Open Sky Guard and Open Sky -${plan} next fight.`);
      break;
    }
    case 'gainCacheReward': {
      const options = alphaCacheSet.options;
      const pick = options[Math.floor((context.random?.() ?? Math.random()) * options.length)];
      pick?.effects.forEach((inner) => resolveRouteEffect(inner, context));
      break;
    }
    case 'addSnagToDiscard': case 'addSnagToDraw': if (arg0) rs.deck.push({ id: arg0 }); break;
    case 'addCard': context.grantCard(arg0); break;
    case 'preenCard': for (let i = 0; i < (n || 1); i += 1) context.preenFirstAvailableCard(); break;
    case 'releaseCard': context.releaseFirstReleasable(n || 1); break;
    case 'gainOpenSkyGuard': mod({ openSkyGuard: (rs.nextCombat?.openSkyGuard ?? 0) + n }); break;
    case 'reduceNextOpenSky': mod({ reduceNextOpenSky: (rs.nextCombat?.reduceNextOpenSky ?? 0) + n }); break;
    case 'enemyCoverNextCombat': mod({ enemyCover: (rs.nextCombat?.enemyCover ?? 0) + n }); break;
    case 'bossDamageShield': mod({ bossDamageShield: (rs.nextCombat?.bossDamageShield ?? 0) + n }); break;
    case 'freePreenNextDistrict': rs.freePreenNextDistrict = (rs.freePreenNextDistrict ?? 0) + (n || 1); break;
    case 'increaseSupplySlots': rs.supplySlots = context.runSupplyCapacity(rs) + (n || 1); break;
    case 'startNextCombatOpenSky': mod({ startOpenSky: true }); break;
    // revealNodes / skipNextStreet / removeRouteChoice are route-graph hints;
    // Alpha pre-reveals the whole map, so they are no-ops here.
    default: break;
  }
}
