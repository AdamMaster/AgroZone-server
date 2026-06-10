import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import 'multer'

@Injectable()
export class FileService {
  private s3Client: S3Client

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      endpoint: this.configService.getOrThrow<string>('S3_ENDPOINT'),
      region: this.configService.get<string>('S3_REGION') || 'ru-1',
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.configService.getOrThrow<string>('S3_SECRET_KEY')
      },
      forcePathStyle: true // Нужно для Timeweb
    })
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'ads') {
    const fileExtension = file.originalname.split('.').pop()
    // Сохраняем структуру папок внутри бакета с помощью косой черты
    const fileName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExtension}`
    const bucketName = this.configService.getOrThrow<string>('S3_BUCKET_NAME')
    const endpoint = this.configService.getOrThrow<string>('S3_ENDPOINT')

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    )

    return {
      url: `${endpoint}/${bucketName}/${fileName}`,
      fileId: fileName
    }
  }

  async deleteFile(fileId: string) {
    const bucketName = this.configService.getOrThrow<string>('S3_BUCKET_NAME')

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileId
      })
    )

    return { success: true }
  }
}
