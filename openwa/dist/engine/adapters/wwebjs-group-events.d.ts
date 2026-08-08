import { type GroupNotification } from 'whatsapp-web.js';
import { GroupEvent } from '../interfaces/whatsapp-engine.interface';
export declare function wwebjsGroupUpdateChanges(notification: GroupNotification): NonNullable<GroupEvent['changes']>;
export declare function wwebjsGroupRecipientIds(notification: GroupNotification): string[];
