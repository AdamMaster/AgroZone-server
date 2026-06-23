import { BadRequestException, Injectable } from '@nestjs/common'
import { AdStatus } from 'prisma/generated/client'

type Action = 'PUBLISH' | 'REJECT' | 'ARCHIVE' | 'ACTIVATE' | 'DRAFT'

@Injectable()
export class AdStateMachineService {
  private transitions: Record<AdStatus, Partial<Record<Action, AdStatus>>> = {
    DRAFT: {
      PUBLISH: AdStatus.PENDING,
      ACTIVATE: AdStatus.PENDING
    },

    PENDING: {
      PUBLISH: AdStatus.PUBLISHED,
      REJECT: AdStatus.REJECTED,
      ARCHIVE: AdStatus.ARCHIVED
    },

    PUBLISHED: {
      ARCHIVE: AdStatus.ARCHIVED
    },

    ARCHIVED: {
      ACTIVATE: AdStatus.PENDING,
      PUBLISH: AdStatus.PENDING
    },

    REJECTED: {
      ACTIVATE: AdStatus.PENDING
    },

    EXPIRED: {
      // обычно только реактивация
      ACTIVATE: AdStatus.PENDING
    }
  }

  canTransition(from: AdStatus, action: Action): boolean {
    return !!this.transitions[from]?.[action]
  }

  transition(from: AdStatus, action: Action): AdStatus {
    const next = this.transitions[from]?.[action]

    if (!next) {
      throw new BadRequestException(`Недопустимый переход: ${from} → ${action}`)
    }

    return next
  }
}
