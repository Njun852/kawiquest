export { Counter, nextId, bumpCounter } from "./_model";
export { Role, Account, PlayerProfile, type IRole, type IAccount, type IPlayerProfile } from "./people";
export {
  Category,
  KawiCharacter,
  GameLevel,
  Quest,
  QuestTask,
  type ICategory,
  type IKawiCharacter,
  type IGameLevel,
  type IQuest,
  type IQuestTask,
} from "./curriculum";
export { HandwritingSample, type IHandwritingSample } from "./dataset";
export {
  GameSession,
  PlayerAttempt,
  PlayerQuestProgress,
  type IGameSession,
  type IPlayerAttempt,
  type IPlayerQuestProgress,
} from "./game";
export {
  Session,
  AuthToken,
  LoginThrottle,
  TOKEN_PURPOSES,
  type ISession,
  type IAuthToken,
  type ILoginThrottle,
  type TokenPurpose,
} from "./auth";

import { Counter } from "./_model";
import { AuthToken, LoginThrottle, Session } from "./auth";
import { Category, GameLevel, KawiCharacter, Quest, QuestTask } from "./curriculum";
import { HandwritingSample } from "./dataset";
import { GameSession, PlayerAttempt, PlayerQuestProgress } from "./game";
import { Account, PlayerProfile, Role } from "./people";

/** The 12 ERD tables. */
export const erdModels = [
  Role,
  Account,
  PlayerProfile,
  Category,
  KawiCharacter,
  GameLevel,
  Quest,
  QuestTask,
  HandwritingSample,
  GameSession,
  PlayerAttempt,
  PlayerQuestProgress,
];

export const allModels = [...erdModels, Counter, Session, AuthToken, LoginThrottle];
