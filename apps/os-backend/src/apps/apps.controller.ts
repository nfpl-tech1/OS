import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AppsService } from './apps.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateAppDto } from './dto/update-app.dto';
import { CreateAppDto } from './dto/create-app.dto';

@Controller('apps')
@UseGuards(JwtAuthGuard)
export class AppsController {
  constructor(private appsService: AppsService) {}

  // GET /apps — list all apps (admin only)
  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAll() {
    return this.appsService.findAll();
  }

  // POST /apps — create app (admin only)
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateAppDto) {
    return this.appsService.create(dto);
  }

  // PATCH /apps/:id — update app details (admin only)
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    return this.appsService.update(id, dto);
  }

  // DELETE /apps/:id — delete app (admin only)
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.appsService.remove(id);
  }

  // POST /apps/:id/image — upload app image (admin only)
  @Post(':id/image')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'app-images'),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `app-${Date.now()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed') as any, false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No image file provided');
    return this.appsService.uploadImage(id, file);
  }
}
