import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class WelcomeScreenConfigDto {
  @ApiProperty({ example: true, description: 'Whether to auto-create welcome screens for new devices' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ example: 'Hello World', description: 'Welcome screen main title' })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({ example: 'This is inker!', description: 'Welcome screen subtitle' })
  @IsString()
  @MaxLength(200)
  subtitle: string;

  @ApiProperty({ example: true, description: 'Whether to auto-assign default playlist to new devices' })
  @IsBoolean()
  autoAssignPlaylist: boolean;
}
