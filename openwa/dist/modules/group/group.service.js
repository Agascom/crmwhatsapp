"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupService = void 0;
const common_1 = require("@nestjs/common");
const engine_registry_service_1 = require("../../engine/engine-registry.service");
const media_cap_util_1 = require("../message/media-cap.util");
const paginate_1 = require("../../common/utils/paginate");
const send_pacing_service_1 = require("../message/send-pacing.service");
let GroupService = class GroupService {
    engines;
    pacing;
    constructor(engines, pacing) {
        this.engines = engines;
        this.pacing = pacing;
    }
    getEngine(sessionId) {
        return this.engines.require(sessionId);
    }
    getGroups(sessionId, opts = {}) {
        return this.getEngine(sessionId)
            .getGroups()
            .then(groups => (0, paginate_1.paginate)(groups, opts.limit, opts.offset));
    }
    async getGroupInfo(sessionId, groupId) {
        const group = await this.getEngine(sessionId).getGroupInfo(groupId);
        if (!group) {
            throw new common_1.NotFoundException(`Group ${groupId} not found`);
        }
        return group;
    }
    async createGroup(sessionId, name, participants) {
        await this.pacing.assertReachoutAllowed(sessionId, participants);
        return this.getEngine(sessionId).createGroup(name, participants);
    }
    async addParticipants(sessionId, groupId, participants) {
        await this.pacing.assertReachoutAllowed(sessionId, participants);
        return this.getEngine(sessionId).addParticipants(groupId, participants);
    }
    removeParticipants(sessionId, groupId, participants) {
        return this.getEngine(sessionId).removeParticipants(groupId, participants);
    }
    promoteParticipants(sessionId, groupId, participants) {
        return this.getEngine(sessionId).promoteParticipants(groupId, participants);
    }
    demoteParticipants(sessionId, groupId, participants) {
        return this.getEngine(sessionId).demoteParticipants(groupId, participants);
    }
    setGroupSubject(sessionId, groupId, subject) {
        return this.getEngine(sessionId).setGroupSubject(groupId, subject);
    }
    setGroupDescription(sessionId, groupId, description) {
        return this.getEngine(sessionId).setGroupDescription(groupId, description);
    }
    leaveGroup(sessionId, groupId) {
        return this.getEngine(sessionId).leaveGroup(groupId);
    }
    getGroupInviteCode(sessionId, groupId) {
        return this.getEngine(sessionId).getGroupInviteCode(groupId);
    }
    revokeGroupInviteCode(sessionId, groupId) {
        return this.getEngine(sessionId).revokeGroupInviteCode(groupId);
    }
    getGroupJoinInfo(sessionId, inviteCode) {
        if (!inviteCode?.trim()) {
            throw new common_1.BadRequestException('An invite code is required');
        }
        return this.getEngine(sessionId).getGroupJoinInfo(inviteCode.trim());
    }
    joinGroupViaInviteCode(sessionId, inviteCode) {
        return this.getEngine(sessionId).joinGroupViaInviteCode(inviteCode);
    }
    getGroupPicture(sessionId, groupId) {
        return this.getEngine(sessionId).getProfilePicture(groupId);
    }
    setGroupPicture(sessionId, groupId, dto) {
        const base64 = (0, media_cap_util_1.stripBase64DataUri)(dto.base64);
        if (!dto.url && !base64) {
            throw new common_1.BadRequestException('Either url or base64 must be provided');
        }
        if (base64 && !dto.mimetype) {
            throw new common_1.BadRequestException('mimetype is required when using base64 data');
        }
        (0, media_cap_util_1.assertBase64WithinMediaCap)(base64);
        const media = {
            mimetype: dto.mimetype || 'image/jpeg',
            data: base64 || dto.url,
        };
        return this.getEngine(sessionId).setGroupPicture(groupId, media);
    }
    deleteGroupPicture(sessionId, groupId) {
        return this.getEngine(sessionId).deleteGroupPicture(groupId);
    }
    async getGroupSettings(sessionId, groupId) {
        const group = await this.getGroupInfo(sessionId, groupId);
        return {
            announce: group.announce,
            locked: group.locked,
            ...(group.ephemeralSeconds !== undefined ? { ephemeralSeconds: group.ephemeralSeconds } : {}),
            ...(group.memberAddMode !== undefined ? { memberAddMode: group.memberAddMode } : {}),
        };
    }
    async updateGroupSettings(sessionId, groupId, settings) {
        const { announce, locked, ephemeralSeconds, memberAddMode } = settings;
        if (announce === undefined &&
            locked === undefined &&
            ephemeralSeconds === undefined &&
            memberAddMode === undefined) {
            throw new common_1.BadRequestException('At least one of announce, locked, ephemeralSeconds, memberAddMode must be provided');
        }
        const engine = this.getEngine(sessionId);
        const steps = [];
        if (ephemeralSeconds !== undefined) {
            steps.push(['ephemeralSeconds', () => engine.setGroupEphemeral(groupId, ephemeralSeconds)]);
        }
        if (memberAddMode !== undefined) {
            steps.push(['memberAddMode', () => engine.setGroupMemberAddMode(groupId, memberAddMode)]);
        }
        if (announce !== undefined) {
            steps.push(['announce', () => engine.setGroupMessagesAdminsOnly(groupId, announce)]);
        }
        if (locked !== undefined) {
            steps.push(['locked', () => engine.setGroupInfoAdminsOnly(groupId, locked)]);
        }
        const applied = [];
        for (const [field, apply] of steps) {
            try {
                await apply();
                applied.push(field);
            }
            catch (error) {
                if (applied.length === 0)
                    throw error;
                const status = error instanceof common_1.HttpException ? error.getStatus() : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
                const detail = error instanceof Error ? error.message : String(error);
                throw new common_1.HttpException(`Group settings only partially applied: '${field}' failed (${detail}); already applied: ${applied.join(', ')}`, status);
            }
        }
    }
};
exports.GroupService = GroupService;
exports.GroupService = GroupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [engine_registry_service_1.EngineRegistry,
        send_pacing_service_1.SendPacingService])
], GroupService);
//# sourceMappingURL=group.service.js.map