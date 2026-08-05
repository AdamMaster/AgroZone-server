import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator'

// Диалог всегда начинает покупатель — по объявлению, к которому у него есть
// вопрос. Продавец инициировать через этот эндпоинт не может: он либо
// отвечает в уже существующем диалоге (см. SendMessageDto), либо диалога с
// ним пока просто нет (см. ConversationsService.startConversation).
export class StartConversationDto {
  @IsUUID()
  adId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string
}
