import type { ImageFeedItem } from "@/lib/stash/feed-item";
import type { StashImage, StashPerformerDetail } from "@/lib/stash/types";
import { encodeCursor, nextCursor, decodeCursor } from "@/lib/utils/cursor";

const TOP_50_MEMES = [
  {
    url: "https://api.memegen.link/images/3hd/Pepperoni/Mushroom/Pineapple.jpg",
    template: "https://api.memegen.link/templates/3hd",
  },
  {
    url: "https://api.memegen.link/images/aag/_/aliens.jpg",
    template: "https://api.memegen.link/templates/aag",
  },
  {
    url: "https://api.memegen.link/images/ackbar/_/it's_a_trap!.jpg",
    template: "https://api.memegen.link/templates/ackbar",
  },
  {
    url: "https://api.memegen.link/images/afraid/i_don't_know_what_this_meme_is_for/and_at_this_point_i'm_too_afraid_to_ask.jpg",
    template: "https://api.memegen.link/templates/afraid",
  },
  {
    url: "https://api.memegen.link/images/agnes/_/i_have_read_and_agree_to_the_terms_and_conditions.jpg",
    template: "https://api.memegen.link/templates/agnes",
  },
  {
    url: "https://api.memegen.link/images/aint-got-time/memes~q/ain't_nobody_got_time_fo'_that.jpg",
    template: "https://api.memegen.link/templates/aint-got-time",
  },
  {
    url: "https://api.memegen.link/images/ams/when_you're_watching_a_movie/and_your_parents_walk_in_at_the_sex_scene.jpg",
    template: "https://api.memegen.link/templates/ams",
  },
  {
    url: "https://api.memegen.link/images/ants/do_you_want_ants~q/because_that's_how_you_get_ants.jpg",
    template: "https://api.memegen.link/templates/ants",
  },
  {
    url: "https://api.memegen.link/images/apcr/I_supported_my_sister's_abortion/Still_would_have_been_cool_to_be_a_dad.jpg",
    template: "https://api.memegen.link/templates/apcr",
  },
  {
    url: "https://api.memegen.link/images/astronaut/Top_Line/Bottom_Line.jpg",
    template: "https://api.memegen.link/templates/astronaut",
  },
  {
    url: "https://api.memegen.link/images/astronaut/Wait,_it's_round~q/Always_has_been/Flat_Earther/Science.jpg",
    template: "https://api.memegen.link/templates/astronaut",
  },
  {
    url: "https://api.memegen.link/images/atis/and_then_i_said/the_exam_will_only_contain_what_we've_covered_in_lectures.jpg",
    template: "https://api.memegen.link/templates/atis",
  },
  {
    url: "https://api.memegen.link/images/away/life.../finds_a_way.jpg",
    template: "https://api.memegen.link/templates/away",
  },
  {
    url: "https://api.memegen.link/images/awesome/say_a_word_wrong/create_hilarious_inside_joke.jpg",
    template: "https://api.memegen.link/templates/awesome",
  },
  {
    url: "https://api.memegen.link/images/awesome-awkward/first_day_at_new_job/spill_coffee_on_bossman.jpg",
    template: "https://api.memegen.link/templates/awesome-awkward",
  },
  {
    url: "https://api.memegen.link/images/awkward/start_telling_joke/forget_punchline.jpg",
    template: "https://api.memegen.link/templates/awkward",
  },
  {
    url: "https://api.memegen.link/images/awkward-awesome/trip_guy_on_the_street/he_was_running_with_a_stolen_purse.jpg",
    template: "https://api.memegen.link/templates/awkward-awesome",
  },
  {
    url: "https://api.memegen.link/images/bad/your_meme_is_bad/and_you_should_feel_bad.jpg",
    template: "https://api.memegen.link/templates/bad",
  },
  {
    url: "https://api.memegen.link/images/badchoice/milk/was_a_bad_choice.jpg",
    template: "https://api.memegen.link/templates/badchoice",
  },
  {
    url: "https://api.memegen.link/images/balloon/Opportunities/Opportunities/Shyness.jpg",
    template: "https://api.memegen.link/templates/balloon",
  },
  {
    url: "https://api.memegen.link/images/bd/can't_workout/don't_want_to_get_too_buff.jpg",
    template: "https://api.memegen.link/templates/bd",
  },
  {
    url: "https://api.memegen.link/images/because/Just_because_you_see_a_Black_man_driving_in_a_nice_car..._does_not_mean_it's_stolen./...I_stole_that_one,_but_not_'cause_I'm_Black!.jpg",
    template: "https://api.memegen.link/templates/because",
  },
  {
    url: "https://api.memegen.link/images/bender/i'm_going_to_build_my_own_theme_park/with_blackjack_and_hookers.jpg",
    template: "https://api.memegen.link/templates/bender",
  },
  {
    url: "https://api.memegen.link/images/bihw/it_ain't_much/but_it's_honest_work.jpg",
    template: "https://api.memegen.link/templates/bihw",
  },
  {
    url: "https://api.memegen.link/images/bilbo/After_all..._why_not~q/Why_shouldn't_I_keep_it~q.jpg",
    template: "https://api.memegen.link/templates/bilbo",
  },
  {
    url: "https://api.memegen.link/images/biw/gets_iced_coffee/in_the_winter.jpg",
    template: "https://api.memegen.link/templates/biw",
  },
  {
    url: "https://api.memegen.link/images/blb/falls_asleep_in_class/has_a_wet_dream.jpg",
    template: "https://api.memegen.link/templates/blb",
  },
  {
    url: "https://api.memegen.link/images/boat/_/i_should_buy_a_boat.jpg",
    template: "https://api.memegen.link/templates/boat",
  },
  {
    url: "https://api.memegen.link/images/bongo/Any_sound_when_you're_trying_to_sleep/Max_volume_alarm_when_you_have_to_wake_up.webp",
    template: "https://api.memegen.link/templates/bongo",
  },
  {
    url: "https://api.memegen.link/images/both/hard_or_soft_tacos/why_not_both~q.webp",
    template: "https://api.memegen.link/templates/both",
  },
  {
    url: "https://api.memegen.link/images/box/_/What's_in_the_box!~q.webp",
    template: "https://api.memegen.link/templates/box",
  },
  {
    url: "https://api.memegen.link/images/bs/what_a_surprise.../you_caught_me_again.jpg",
    template: "https://api.memegen.link/templates/bs",
  },
  {
    url: "https://api.memegen.link/images/bus/Top_Line/Bottom_Line.jpg",
    template: "https://api.memegen.link/templates/bus",
  },
  {
    url: "https://api.memegen.link/images/bus/Postseason/Preseason.jpg",
    template: "https://api.memegen.link/templates/bus",
  },
  {
    url: "https://api.memegen.link/images/buzz/memes/memes_everywhere.webp",
    template: "https://api.memegen.link/templates/buzz",
  },
  {
    url: "https://api.memegen.link/images/buzz/Top_Line/Bottom_Line.webp",
    template: "https://api.memegen.link/templates/buzz",
  },
  {
    url: "https://api.memegen.link/images/cake/_/I_was_told_there_would_be_cake.webp",
    template: "https://api.memegen.link/templates/cake",
  },
  {
    url: "https://api.memegen.link/images/captain/look_at_me/i_am_the_captain_now.jpg",
    template: "https://api.memegen.link/templates/captain",
  },
  {
    url: "https://api.memegen.link/images/captain-america/Have_you_ever_eaten_a_clock~q/No,_why~q/It's_time_consuming..jpg",
    template: "https://api.memegen.link/templates/captain-america",
  },
  {
    url: "https://api.memegen.link/images/cb/i_stole/the_pic--i--nic_basket.jpg",
    template: "https://api.memegen.link/templates/cb",
  },
  {
    url: "https://api.memegen.link/images/cbb/_/our_memes!.jpg",
    template: "https://api.memegen.link/templates/cbb",
  },
  {
    url: "https://api.memegen.link/images/cbg/_/worst_thing_ever!.jpg",
    template: "https://api.memegen.link/templates/cbg",
  },
  {
    url: "https://api.memegen.link/images/center/what_is_this/a_center_for_ants.jpg",
    template: "https://api.memegen.link/templates/center",
  },
  {
    url: "https://api.memegen.link/images/ch/if_you_wanted_to_avoid_the_friend_zone/you_should_have_made_your_intentions_known_from_the_start.jpg",
    template: "https://api.memegen.link/templates/ch",
  },
  {
    url: "https://api.memegen.link/images/chair/Let's_expand_safety_nets/Socialism_never_works!/Scandinavia_is_socialist_and_they're_doing_great!/They're_not_socialist._They're_capitalist_with_strong_welfare_policies!/Then_let's_adopt_those!/No_that's_socialism!!.jpg",
    template: "https://api.memegen.link/templates/chair",
  },
  {
    url: "https://api.memegen.link/images/cheems/it's_a_good_time_to_sleep/nothing_will_go_wrong_after_this.jpg",
    template: "https://api.memegen.link/templates/cheems",
  },
  {
    url: "https://api.memegen.link/images/chosen/you_were_the_chosen_one!.jpg",
    template: "https://api.memegen.link/templates/chosen",
  },
  {
    url: "https://api.memegen.link/images/cmm/pineapples_don't_belong_on_pizza.jpg",
    template: "https://api.memegen.link/templates/cmm",
  },
  {
    url: "https://api.memegen.link/images/country/Inflammable_means_flammable~q/What_a_country!.jpg",
    template: "https://api.memegen.link/templates/country",
  },
  {
    url: "https://api.memegen.link/images/crazypills/_/i_feel_like_i'm_taking_crazy_pills.jpg",
    template: "https://api.memegen.link/templates/crazypills",
  },
];

export const DEMO_PERFORMERS = [
  {
    id: "dp-1",
    name: "Alice Memer",
    image_path: TOP_50_MEMES[13].url,
    scene_count: 12,
    image_count: 8,
    gender: "FEMALE",
  },
  {
    id: "dp-2",
    name: "Bob Doge",
    image_path: TOP_50_MEMES[1].url,
    scene_count: 9,
    image_count: 5,
    gender: "MALE",
  },
  {
    id: "dp-3",
    name: "Charlie Wojak",
    image_path: TOP_50_MEMES[15].url,
    scene_count: 7,
    image_count: 11,
    gender: "MALE",
  },
  {
    id: "dp-4",
    name: "Diana Pepe",
    image_path: TOP_50_MEMES[3].url,
    scene_count: 15,
    image_count: 3,
    gender: "FEMALE",
  },
  {
    id: "dp-5",
    name: "Edward Based",
    image_path: TOP_50_MEMES[22].url,
    scene_count: 4,
    image_count: 9,
    gender: "MALE",
  },
  {
    id: "dp-6",
    name: "Fiona Cringe",
    image_path: TOP_50_MEMES[41].url,
    scene_count: 6,
    image_count: 14,
    gender: "FEMALE",
  },
  {
    id: "dp-7",
    name: "George Gigachad",
    image_path: TOP_50_MEMES[46].url,
    scene_count: 20,
    image_count: 0,
    gender: "MALE",
  },
  {
    id: "dp-8",
    name: "Hannah Kek",
    image_path: TOP_50_MEMES[19].url,
    scene_count: 8,
    image_count: 7,
    gender: "FEMALE",
  },
  {
    id: "dp-9",
    name: "Ivan Trollge",
    image_path: TOP_50_MEMES[49].url,
    scene_count: 3,
    image_count: 12,
    gender: "MALE",
  },
  {
    id: "dp-10",
    name: "Julia Ratio",
    image_path: TOP_50_MEMES[44].url,
    scene_count: 11,
    image_count: 6,
    gender: "FEMALE",
  },
];

export const DEMO_STUDIOS = [
  {
    id: "ds-1",
    name: "Meme Factory",
    image_path: TOP_50_MEMES[27].url,
    scene_count: 25,
  },
  {
    id: "ds-2",
    name: "Dank Productions",
    image_path: TOP_50_MEMES[34].url,
    scene_count: 18,
  },
  {
    id: "ds-3",
    name: "Based Studios",
    image_path: TOP_50_MEMES[9].url,
    scene_count: 30,
  },
  {
    id: "ds-4",
    name: "Cope & Seethe LLC",
    image_path: TOP_50_MEMES[17].url,
    scene_count: 12,
  },
  {
    id: "ds-5",
    name: "Touch Grass Media",
    image_path: TOP_50_MEMES[36].url,
    scene_count: 15,
  },
];

export const DEMO_TAGS = [
  {
    id: "dt-1",
    name: "Funny",
    image_path: null,
    scene_count: 30,
    image_count: 20,
  },
  {
    id: "dt-2",
    name: "Relatable",
    image_path: null,
    scene_count: 25,
    image_count: 15,
  },
  {
    id: "dt-3",
    name: "Cringe",
    image_path: null,
    scene_count: 10,
    image_count: 8,
  },
  {
    id: "dt-4",
    name: "Based",
    image_path: null,
    scene_count: 20,
    image_count: 12,
  },
  {
    id: "dt-5",
    name: "Dank",
    image_path: null,
    scene_count: 35,
    image_count: 25,
  },
  {
    id: "dt-6",
    name: "Meta",
    image_path: null,
    scene_count: 8,
    image_count: 5,
  },
  {
    id: "dt-7",
    name: "Dark Humor",
    image_path: null,
    scene_count: 15,
    image_count: 10,
  },
  {
    id: "dt-8",
    name: "Wholesome",
    image_path: null,
    scene_count: 12,
    image_count: 18,
  },
  {
    id: "dt-9",
    name: "Ratio'd",
    image_path: null,
    scene_count: 5,
    image_count: 3,
  },
  {
    id: "dt-10",
    name: "Touch Grass",
    image_path: null,
    scene_count: 7,
    image_count: 4,
  },
  {
    id: "dt-11",
    name: "Sigma",
    image_path: null,
    scene_count: 18,
    image_count: 9,
  },
  {
    id: "dt-12",
    name: "Gigachad",
    image_path: null,
    scene_count: 14,
    image_count: 6,
  },
  {
    id: "dt-13",
    name: "Wojak",
    image_path: null,
    scene_count: 22,
    image_count: 11,
  },
  {
    id: "dt-14",
    name: "Pepe",
    image_path: null,
    scene_count: 28,
    image_count: 16,
  },
  {
    id: "dt-15",
    name: "Normie",
    image_path: null,
    scene_count: 9,
    image_count: 7,
  },
];

// mulberry32 seeded PRNG — deterministic per item
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function extractTemplateId(url: string): string {
  const m = url.match(/\/images\/([^/]+)\//);
  return m?.[1] ?? "meme";
}

function extractMemeTitle(url: string): string {
  const m = url.match(/\/images\/[^/]+\/(.+)\.(jpg|webp|png|gif)$/);
  if (!m) return "";
  return m[1]
    .split("/")
    .filter((p) => p !== "_" && p !== "")
    .map((p) => p.replace(/~q/g, "?").replace(/--/g, "‒").replace(/_/g, " "))
    .join(" / ");
}

const BASE_DATE = new Date("2024-01-01").getTime();

export const DEMO_ITEMS: ImageFeedItem[] = TOP_50_MEMES.map((meme, i) => {
  const rng = seeded(i * 31337 + 1);
  const templateId = extractTemplateId(meme.url);
  const title = extractMemeTitle(meme.url) || null;
  const performer = pick(DEMO_PERFORMERS, rng);
  const studio = pick(DEMO_STUDIOS, rng);
  const tagCount = 1 + Math.floor(rng() * 3);
  const tags = pickN(DEMO_TAGS, tagCount, rng).map(({ id, name }) => ({
    id,
    name,
  }));
  const daysOffset = Math.floor(rng() * 500);
  const date = new Date(BASE_DATE + daysOffset * 86400000)
    .toISOString()
    .substring(0, 10);
  const rating100 = Math.floor(rng() * 51) + 50;
  const o_counter = Math.floor(rng() * 21);

  return {
    id: `demo-${i}`,
    type: "image" as const,
    title,
    subreddit: templateId,
    subredditDisplay:
      templateId.charAt(0).toUpperCase() +
      templateId.slice(1).replace(/-/g, " "),
    date,
    studio: { id: studio.id, name: studio.name, image_path: null },
    performers: [{ id: performer.id, name: performer.name, image_path: null }],
    tags,
    metaPerformer: performer.name,
    metaOrigin: null,
    metaCredit: null,
    metaDay: null,
    paths: { thumbnail: meme.url, preview: null },
    rating100,
    o_counter,
    directUrl: null,
    files: [{ width: 800, height: 600 }],
  };
});

const PER_PAGE = 20;

export function demoFeedResponse(
  cursorParam: string | null,
  sort: string,
): Response {
  let page = 1;
  let seed: number | undefined;
  if (cursorParam) {
    try {
      const decoded = decodeCursor(cursorParam);
      page = decoded.page;
      seed = decoded.seed;
    } catch {}
  }

  let items = [...DEMO_ITEMS];
  if (sort === "rating") {
    items = items.sort((a, b) => (b.rating100 ?? 0) - (a.rating100 ?? 0));
  } else if (sort === "random" && seed !== undefined) {
    const rng = seeded(seed);
    items = items.sort(() => rng() - 0.5);
  }

  const total = items.length;
  const start = (page - 1) * PER_PAGE;
  const pageItems = items.slice(start, start + PER_PAGE);

  const cursor = encodeCursor({ page, perPage: PER_PAGE, total, sort, seed });
  const next = nextCursor({ page, perPage: PER_PAGE, total, sort, seed });

  return new Response(
    JSON.stringify({ items: pageItems, cursor, nextCursor: next, total }),
    { headers: { "Content-Type": "application/json" } },
  );
}

export function demoPerformersResponse(): Response {
  return new Response(
    JSON.stringify({
      count: DEMO_PERFORMERS.length,
      performers: DEMO_PERFORMERS,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

export function demoStudiosResponse(): Response {
  return new Response(
    JSON.stringify({ count: DEMO_STUDIOS.length, studios: DEMO_STUDIOS }),
    { headers: { "Content-Type": "application/json" } },
  );
}

export function demoTagsResponse(): Response {
  return new Response(
    JSON.stringify({ count: DEMO_TAGS.length, tags: DEMO_TAGS }),
    { headers: { "Content-Type": "application/json" } },
  );
}

export function demoVoteResponse(body: {
  id: string;
  type: "o_counter" | "play_count";
}): Response {
  if (body.type === "o_counter") {
    return new Response(JSON.stringify({ o_counter: 1 }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ id: body.id, play_count: 1 }), {
    headers: { "Content-Type": "application/json" },
  });
}

// --- SSR page helpers ---

export function demoFirstPage(sort = "date"): {
  items: ImageFeedItem[];
  count: number;
  seed?: number;
} {
  let items = [...DEMO_ITEMS];
  let seed: number | undefined;
  if (sort === "rating") {
    items.sort((a, b) => (b.rating100 ?? 0) - (a.rating100 ?? 0));
  } else if (sort === "random") {
    seed = Math.floor(Math.random() * 2_147_483_647);
    const rng = seeded(seed);
    items.sort(() => rng() - 0.5);
  }
  return { items: items.slice(0, 20), count: DEMO_ITEMS.length, seed };
}

export function demoItemsFiltered(opts: {
  tagId?: string;
  studioId?: string;
  performerId?: string;
  sort?: string;
}): { items: ImageFeedItem[]; count: number } {
  let items = [...DEMO_ITEMS];
  if (opts.tagId)
    items = items.filter((i) => i.tags.some((t) => t.id === opts.tagId));
  if (opts.studioId)
    items = items.filter((i) => i.studio?.id === opts.studioId);
  if (opts.performerId)
    items = items.filter((i) =>
      i.performers.some((p) => p.id === opts.performerId),
    );
  const sort = opts.sort ?? "date";
  if (sort === "rating")
    items.sort((a, b) => (b.rating100 ?? 0) - (a.rating100 ?? 0));
  return { items: items.slice(0, 20), count: items.length };
}

export function getDemoImage(id: string): StashImage | undefined {
  const item = DEMO_ITEMS.find((i) => i.id === id);
  if (!item) return undefined;
  return {
    id: item.id,
    title: item.title,
    date: item.date,
    created_at: item.date ? item.date + "T00:00:00.000Z" : null,
    details: null,
    rating100: item.rating100,
    o_counter: item.o_counter,
    paths: { thumbnail: item.paths.thumbnail, preview: null },
    studio: item.studio ? { id: item.studio.id, name: item.studio.name } : null,
    performers: item.performers,
    tags: item.tags,
    files: [{ id, path: null, basename: null, width: 800, height: 600 }],
    visual_files: [],
  };
}

export function getDemoTag(id: string): {
  id: string;
  name: string;
  image_path: string | null;
  scene_count: number | null;
} | null {
  return DEMO_TAGS.find((t) => t.id === id) ?? null;
}

export function getDemoStudio(id: string): {
  id: string;
  name: string;
  image_path: string | null;
  scene_count: number | null;
} | null {
  return DEMO_STUDIOS.find((s) => s.id === id) ?? null;
}

export function getDemoPerformer(id: string): StashPerformerDetail | null {
  const p = DEMO_PERFORMERS.find((p) => p.id === id);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    image_path: p.image_path,
    scene_count: p.scene_count,
    image_count: p.image_count,
    gender: p.gender,
    details: null,
    birthdate: null,
  };
}
