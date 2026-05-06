// Hand-authored stub: replace by running: npm run codegen
// These types reflect the Stash GraphQL schema fields used in queries.ts

export type Maybe<T> = T | null | undefined;

export type StashPaths = {
  stream: Maybe<string>;
  screenshot: Maybe<string>;
  preview: Maybe<string>;
  sprite: Maybe<string>;
  vtt: Maybe<string>;
};

export type StashVideoFile = {
  id: string;
  path: string;
  width: number;
  height: number;
  duration: number;
  video_codec: Maybe<string>;
  audio_codec: Maybe<string>;
  size: number;
};

export type StashTag = {
  id: string;
  name: string;
  image_path: Maybe<string>;
  scene_count: Maybe<number>;
  image_count: Maybe<number>;
};

export type StashStudio = {
  id: string;
  name: string;
  image_path: Maybe<string>;
  scene_count: Maybe<number>;
  url: Maybe<string>;
};

export type StashPerformer = {
  id: string;
  name: string;
  image_path: Maybe<string>;
  scene_count: Maybe<number>;
  image_count: Maybe<number>;
  gender: Maybe<string>;
};

export type StashScene = {
  id: string;
  title: Maybe<string>;
  details: Maybe<string>;
  date: Maybe<string>;
  created_at: Maybe<string>;
  rating100: Maybe<number>;
  o_counter: Maybe<number>;
  play_count: Maybe<number>;
  paths: StashPaths;
  files: StashVideoFile[];
  studio: Maybe<StashStudio>;
  performers: StashPerformer[];
  tags: StashTag[];
};

export type FindScenesQuery = {
  findScenes: {
    count: number;
    scenes: StashScene[];
  };
};

export type FindSceneQuery = {
  findScene: Maybe<StashScene>;
};

export type FindTagsQuery = {
  findTags: {
    count: number;
    tags: StashTag[];
  };
};

export type FindStudiosQuery = {
  findStudios: {
    count: number;
    studios: StashStudio[];
  };
};

export type FindPerformersQuery = {
  findPerformers: {
    count: number;
    performers: StashPerformer[];
  };
};

export type SceneIncrementOMutation = {
  sceneIncrementO: number;
};

export type ImageIncrementOMutation = {
  imageIncrementO: number;
};

export type SceneAddPlayMutation = {
  sceneAddPlay: { id: string; play_count: number };
};

export type StashImagePaths = {
  thumbnail: Maybe<string>;
  preview: Maybe<string>;
};

export type StashImageFile = {
  id: string;
  path: Maybe<string>;
  basename: Maybe<string>;
  width: number;
  height: number;
};

export type StashVisualFile = {
  path: Maybe<string>;
  basename: Maybe<string>;
};

export type StashImage = {
  id: string;
  title: Maybe<string>;
  date: Maybe<string>;
  created_at: Maybe<string>;
  details: Maybe<string>;
  rating100: Maybe<number>;
  o_counter: Maybe<number>;
  paths: StashImagePaths;
  studio: Maybe<{ id: string; name: string }>;
  performers: { id: string; name: string; image_path: Maybe<string> }[];
  tags: { id: string; name: string }[];
  files: StashImageFile[];
  visual_files?: StashVisualFile[];
};

export type FindImagesQuery = {
  findImages: {
    count: number;
    images: StashImage[];
  };
};

export type FindImageQuery = {
  findImage: Maybe<StashImage>;
};

export type StashPerformerDetail = {
  id: string;
  name: string;
  image_path: Maybe<string>;
  scene_count: Maybe<number>;
  image_count: Maybe<number>;
  details: Maybe<string>;
  birthdate: Maybe<string>;
  gender: Maybe<string>;
};

export type FindPerformerQuery = {
  findPerformer: Maybe<StashPerformerDetail>;
};

export type FindTagQuery = {
  findTag: Maybe<{
    id: string;
    name: string;
    image_path: Maybe<string>;
    scene_count: Maybe<number>;
  }>;
};

export type FindStudioQuery = {
  findStudio: Maybe<{
    id: string;
    name: string;
    image_path: Maybe<string>;
    scene_count: Maybe<number>;
  }>;
};

// Filter types used by API routes
export type FindFilterType = {
  q?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  direction?: "ASC" | "DESC";
  seed?: number;
};

export type MultiIDCriterion = {
  value: string[];
  modifier: "INCLUDES_ALL" | "INCLUDES" | "EXCLUDES";
};

export type SceneFilterType = {
  tags?: MultiIDCriterion;
  studios?: MultiIDCriterion;
  performers?: MultiIDCriterion;
};

export type ImageFilterType = {
  performers?: MultiIDCriterion;
  tags?: MultiIDCriterion;
  studios?: MultiIDCriterion;
  galleries?: MultiIDCriterion;
};
