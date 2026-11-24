/** Shared Course-shaped fixtures for the render/build tests. */
export const demoCourse = {
  slug: "demo-course",
  title: "Demo course",
  promise: "Twelve interactive steps from next-token prediction to alignment.",
  kind: "app",
  status: "live",
  order: 10,
  hours: 8,
  tags: ["demo"],
  app: { entry: "index.html", build: null, mountDir: "app" },
  lessons: null,
  assessments: [
    { id: "check", title: "Check yourself", engine: "items", file: "assessments/check.json" },
    { id: "sim", title: "Priced scenario", engine: "custom", href: "assessment.html" },
  ],
  contents: [{ title: "Entropy", href: "app/01-entropy.html", note: "bits and surprise" }],
  progressKey: "learning:demo-course:v1",
  dir: "/fixtures/demo-course",
};

export const secondCourse = {
  slug: "second-course",
  title: "Second course",
  promise: "A lessons-only course about queues.",
  kind: "lessons",
  status: "live",
  order: 20,
  hours: 4,
  tags: [],
  app: null,
  lessons: { root: "lessons", order: ["01-intro", "02-deep"], items: [] },
  assessments: [],
  contents: [],
  progressKey: "learning:second-course:v1",
  dir: "/fixtures/second-course",
};

export const courseWithLab = {
  slug: "lab-course",
  title: "Lab course",
  promise: "One week of Python.",
  kind: "lessons",
  status: "live",
  order: 30,
  hours: 1,
  tags: [],
  app: null,
  lessons: { root: "lessons", order: ["w01"], items: [] },
  assessments: [],
  contents: [],
  progressKey: "learning:lab-course:v1",
  dir: "/fixtures/lab-course",
};
