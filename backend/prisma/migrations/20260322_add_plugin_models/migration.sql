-- CreateTable
CREATE TABLE "plugins" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "data_strategy" TEXT NOT NULL DEFAULT 'polling',
    "data_url" TEXT,
    "data_method" TEXT NOT NULL DEFAULT 'GET',
    "data_headers" JSONB,
    "data_path" TEXT,
    "data_transform" TEXT,
    "refresh_interval" INTEGER NOT NULL DEFAULT 300,
    "markup_full" TEXT,
    "markup_half_horizontal" TEXT,
    "markup_half_vertical" TEXT,
    "markup_quadrant" TEXT,
    "settings_schema" JSONB,
    "oauth_provider" TEXT,
    "oauth_scopes" TEXT,
    "is_installed" BOOLEAN NOT NULL DEFAULT false,
    "is_builtin" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'inker',
    "source_url" TEXT,
    "source_hash" TEXT,
    "version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_instances" (
    "id" SERIAL NOT NULL,
    "plugin_id" INTEGER NOT NULL,
    "name" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "settings_encrypted" JSONB NOT NULL DEFAULT '{}',
    "oauth_token" TEXT,
    "oauth_refresh_token" TEXT,
    "oauth_expires_at" TIMESTAMP(3),
    "last_data" JSONB,
    "last_fetched_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_instances_pkey" PRIMARY KEY ("id")
);

-- Add plugin_instance_id to playlist_items
ALTER TABLE "playlist_items" ADD COLUMN "plugin_instance_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "plugins_slug_key" ON "plugins"("slug");

-- AddForeignKey
ALTER TABLE "plugin_instances" ADD CONSTRAINT "plugin_instances_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_plugin_instance_id_fkey" FOREIGN KEY ("plugin_instance_id") REFERENCES "plugin_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
