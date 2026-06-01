import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class PreviewCustomWidgetDto {
  @ApiPropertyOptional({
    example: { city: 'Berlin' },
    description: 'Context values used while rendering a saved custom widget preview',
  })
  @IsOptional()
  @IsObject()
  ctx?: Record<string, unknown>;
}
