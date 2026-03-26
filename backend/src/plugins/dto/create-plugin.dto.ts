import { IsString, IsOptional, IsNumber, IsArray, IsBoolean } from 'class-validator';

export class CreatePluginDto {
  @IsString() name: string;
  @IsString() slug: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() category?: string;

  @IsOptional() @IsString() dataStrategy?: string;
  @IsOptional() @IsString() dataUrl?: string;
  @IsOptional() @IsString() dataMethod?: string;
  @IsOptional() dataHeaders?: Record<string, string>;
  @IsOptional() @IsString() dataPath?: string;
  @IsOptional() @IsString() dataTransform?: string;
  @IsOptional() @IsNumber() refreshInterval?: number;

  @IsOptional() @IsString() markupFull?: string;
  @IsOptional() @IsString() markupHalfHorizontal?: string;
  @IsOptional() @IsString() markupHalfVertical?: string;
  @IsOptional() @IsString() markupQuadrant?: string;

  @IsOptional() @IsArray() settingsSchema?: any[];

  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() sourceUrl?: string;
  @IsOptional() @IsString() version?: string;
}

export class UpdatePluginDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() category?: string;

  @IsOptional() @IsString() dataUrl?: string;
  @IsOptional() @IsString() dataMethod?: string;
  @IsOptional() dataHeaders?: Record<string, string>;
  @IsOptional() @IsString() dataPath?: string;
  @IsOptional() @IsString() dataTransform?: string;
  @IsOptional() @IsNumber() refreshInterval?: number;

  @IsOptional() @IsString() markupFull?: string;
  @IsOptional() @IsString() markupHalfHorizontal?: string;
  @IsOptional() @IsString() markupHalfVertical?: string;
  @IsOptional() @IsString() markupQuadrant?: string;

  @IsOptional() @IsArray() settingsSchema?: any[];
  @IsOptional() @IsString() version?: string;
}

export class CreatePluginInstanceDto {
  @IsNumber() pluginId: number;
  @IsOptional() @IsString() name?: string;
  @IsOptional() settings?: Record<string, any>;
}

export class UpdatePluginInstanceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() settings?: Record<string, any>;
}
