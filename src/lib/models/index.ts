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
export {
  HandwritingSample,
  CharacterValidation,
  VALIDATION_STATUSES,
  type IHandwritingSample,
  type ICharacterValidation,
  type ValidationStatus,
} from "./dataset";
export {
  GameSession,
  PlayerAttempt,
  PlayerQuestProgress,
  PlayerAchievement,
  PlayerItem,
  type IGameSession,
  type IPlayerAttempt,
  type IPlayerQuestProgress,
  type IPlayerAchievement,
  type IPlayerItem,
} from "./game";
export { GameBuild, BuildUpload, BUILD_PLATFORMS, type IGameBuild, type IBuildUpload, type BuildPlatform } from "./builds";
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
import { CharacterValidation, HandwritingSample } from "./dataset";
import { BuildUpload, GameBuild } from "./builds";
import { GameSession, PlayerAchievement, PlayerAttempt, PlayerItem, PlayerQuestProgress } from "./game";
import { Account, PlayerProfile, Role } from "./people";

/**
 * The 12 ERD tables plus the approved additions: character_validations (2026-10-26), and game_builds,
 * player_achievements and player_items (2026-11-10).
 */
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
  CharacterValidation,
  GameSession,
  PlayerAttempt,
  PlayerQuestProgress,
  PlayerAchievement,
  PlayerItem,
  GameBuild,
];

export const allModels = [...erdModels, Counter, Session, AuthToken, LoginThrottle, BuildUpload];
