import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import ImageKit from 'imagekit'

@Injectable()
export class FileService {
  private imagekit: ImageKit

  constructor(private readonly configService: ConfigService) {
    this.imagekit = new ImageKit({
      publicKey: this.configService.getOrThrow<string>('IMAGEKIT_PUBLIC_KEY'),
      privateKey: this.configService.getOrThrow<string>('IMAGEKIT_PRIVATE_KEY'),
      urlEndpoint: this.configService.getOrThrow<string>('IMAGEKIT_URL_ENDPOINT')
    })
  }

  async uploadFile(file: any, folder: string = 'avatars') {
    const response = await this.imagekit.upload({
      file: file.buffer,
      fileName: `${Date.now()}-${file.originalname}`,
      folder: folder
    })

    return {
      url: response.url,
      fileId: response.fileId
    }
  }
}
