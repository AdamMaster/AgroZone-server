import { BadRequestException, Injectable } from '@nestjs/common'
import { AdStatus } from '@/generated/prisma/client'

type Action = 'PUBLISH' | 'REJECT' | 'ARCHIVE' | 'ACTIVATE' | 'DRAFT'

@Injectable()
export class AdStateMachineService {
  private transitions: Record<AdStatus, Partial<Record<Action, AdStatus>>> = {
    DRAFT: {
      PUBLISH: AdStatus.PENDING,
      ACTIVATE: AdStatus.PENDING
    },

    // Разрешаем возвращаться в черновик из PENDING или REJECTED,
    // если пользователь решил доработать объявление
    PENDING: {
      PUBLISH: AdStatus.PUBLISHED,
      REJECT: AdStatus.REJECTED,
      ARCHIVE: AdStatus.ARCHIVED,
      DRAFT: AdStatus.DRAFT // <--- Добавляем это
    },

    REJECTED: {
      ACTIVATE: AdStatus.PENDING,
      DRAFT: AdStatus.DRAFT // <--- И это (если отклонили, уходим в черновик исправлять)
    },

    PUBLISHED: {
      ARCHIVE: AdStatus.ARCHIVED
      // PUBLISHED обычно не уходит в DRAFT, так как оно уже "в эфире"
    },

    ARCHIVED: {
      ACTIVATE: AdStatus.PENDING,
      PUBLISH: AdStatus.PENDING,
      DRAFT: AdStatus.DRAFT // <--- Из архива тоже можно вернуть в черновик
    },

    EXPIRED: {
      ACTIVATE: AdStatus.PENDING,
      DRAFT: AdStatus.DRAFT
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
