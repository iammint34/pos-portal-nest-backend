import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadsService {
  private readonly uploadDir: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveImage(file: {
    filename: string;
    mimetype: string;
    file: NodeJS.ReadableStream;
  }): Promise<string> {
    const ext = path.extname(file.filename) || '.jpg';
    const uniqueName = `${randomUUID()}${ext}`;
    const filePath = path.join(this.uploadDir, uniqueName);

    const writeStream = fs.createWriteStream(filePath);

    await new Promise<void>((resolve, reject) => {
      file.file.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Return the relative URL path
    const baseUrl = this.configService.get(
      'BASE_URL',
      'http://localhost:3000',
    );
    return `${baseUrl}/uploads/${uniqueName}`;
  }
}
