import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ScreenRenderDocument } from './screen-render-document';

export abstract class ScreenRenderEngine implements Partial<OnModuleInit>, Partial<OnModuleDestroy> {
  abstract renderJsx(document: ScreenRenderDocument): Promise<Buffer>;

  onModuleInit?(): Promise<void> | void;
  onModuleDestroy?(): Promise<void> | void;
}
