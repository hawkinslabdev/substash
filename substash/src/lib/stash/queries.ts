import { gql } from "graphql-request";

export const FIND_SCENES = gql`
  query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType) {
    findScenes(filter: $filter, scene_filter: $scene_filter) {
      count
      scenes {
        id
        title
        date
        created_at
        rating100
        o_counter
        play_count
        paths {
          stream
          screenshot
          preview
        }
        files {
          path
          width
          height
          duration
        }
        studio {
          id
          name
        }
        performers {
          id
          name
          image_path
        }
        tags {
          id
          name
        }
      }
    }
  }
`;

export const FIND_SCENE = gql`
  query FindScene($id: ID!) {
    findScene(id: $id) {
      id
      title
      details
      date
      created_at
      rating100
      o_counter
      play_count
      paths {
        stream
        screenshot
        preview
        sprite
        vtt
      }
      files {
        id
        path
        width
        height
        duration
        video_codec
        audio_codec
        size
      }
      studio {
        id
        name
        image_path
        url
      }
      performers {
        id
        name
        image_path
        gender
      }
      tags {
        id
        name
      }
    }
  }
`;

export const FIND_TAGS = gql`
  query FindTags($filter: FindFilterType) {
    findTags(filter: $filter) {
      count
      tags {
        id
        name
        image_path
        scene_count
        image_count
      }
    }
  }
`;

export const FIND_STUDIOS = gql`
  query FindStudios($filter: FindFilterType) {
    findStudios(filter: $filter) {
      count
      studios {
        id
        name
        image_path
        scene_count
      }
    }
  }
`;

export const FIND_PERFORMERS = gql`
  query FindPerformers($filter: FindFilterType) {
    findPerformers(filter: $filter) {
      count
      performers {
        id
        name
        image_path
        scene_count
        image_count
        gender
      }
    }
  }
`;

export const FIND_TAG = gql`
  query FindTag($id: ID!) {
    findTag(id: $id) {
      id
      name
      image_path
      scene_count
      image_count
    }
  }
`;

export const FIND_STUDIO = gql`
  query FindStudio($id: ID!) {
    findStudio(id: $id) {
      id
      name
      image_path
      scene_count
    }
  }
`;

export const FIND_PERFORMER = gql`
  query FindPerformer($id: ID!) {
    findPerformer(id: $id) {
      id
      name
      image_path
      scene_count
      image_count
      details
      birthdate
      gender
    }
  }
`;

export const FIND_IMAGES = gql`
  query FindImages($filter: FindFilterType, $image_filter: ImageFilterType) {
    findImages(filter: $filter, image_filter: $image_filter) {
      count
      images {
        id
        title
        date
        created_at
        rating100
        o_counter
        paths {
          thumbnail
          preview
        }
        studio {
          id
          name
        }
        performers {
          id
          name
          image_path
        }
        tags {
          id
          name
        }
        files {
          width
          height
          path
          basename
        }
      }
    }
  }
`;

export const FIND_IMAGE = gql`
  query FindImage($id: ID!) {
    findImage(id: $id) {
      id
      title
      date
      created_at
      details
      rating100
      o_counter
      paths {
        thumbnail
        preview
      }
      studio {
        id
        name
      }
      performers {
        id
        name
        image_path
      }
      tags {
        id
        name
      }
      files {
        id
        width
        height
        path
        basename
      }
      visual_files {
        ... on ImageFile {
          path
          basename
        }
        ... on VideoFile {
          path
          basename
        }
      }
    }
  }
`;

export const SCENE_INCREMENT_O = gql`
  mutation SceneIncrementO($id: ID!) {
    sceneIncrementO(id: $id)
  }
`;

export const IMAGE_INCREMENT_O = gql`
  mutation ImageIncrementO($id: ID!) {
    imageIncrementO(id: $id)
  }
`;

export const SCENE_ADD_PLAY = gql`
  mutation SceneAddPlay($id: ID!) {
    sceneAddPlay(id: $id) {
      id
      play_count
    }
  }
`;

// Empty input objects: Stash applies the defaults configured in its own
// Settings > Tasks tab when fields are omitted, so we don't replicate them here.
export const METADATA_SCAN = gql`
  mutation MetadataScan {
    metadataScan(input: {})
  }
`;

export const METADATA_AUTO_TAG = gql`
  mutation MetadataAutoTag {
    metadataAutoTag(input: {})
  }
`;

export const METADATA_GENERATE = gql`
  mutation MetadataGenerate {
    metadataGenerate(input: {})
  }
`;
