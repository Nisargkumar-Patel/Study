"""Curated skills vocabulary for rule-based extraction.

Kept in its own module so the (large) literal data stays out of the extractor
logic. Three exports:

- ``SKILLS_DATABASE``: canonical skill/technology phrases to match (lowercase).
- ``SKILL_ALIASES``: surface form -> canonical skill, so "k8s" resolves to
  "kubernetes", "postgres" to "postgresql", etc. Aliases are matched in the
  text but reported using their canonical name.
- ``TECH_SKILLS``: subset of canonical skills considered "technologies"
  (languages, frameworks, tools, cloud, data) used to populate the
  ``technologies`` field. Soft skills are excluded.
"""

from typing import Dict, List, Set


# ---------------------------------------------------------------------------
# Canonical skills, grouped only for human readability. Order does not matter;
# duplicates are removed when the matcher is built.
# ---------------------------------------------------------------------------

_PROGRAMMING_LANGUAGES = [
    "python", "java", "javascript", "typescript", "c", "c++", "c#", "go", "golang",
    "rust", "ruby", "php", "swift", "kotlin", "scala", "perl", "r", "matlab",
    "objective-c", "dart", "elixir", "erlang", "haskell", "clojure", "f#", "groovy",
    "lua", "julia", "fortran", "cobol", "assembly", "vba", "powershell", "bash",
    "shell", "zsh", "sql", "pl/sql", "t-sql", "html", "css", "sass", "scss", "less",
    "solidity", "verilog", "vhdl", "racket", "scheme", "ocaml", "crystal", "nim",
]

_FRONTEND = [
    "react", "react native", "angular", "angularjs", "vue", "vue.js", "svelte",
    "sveltekit", "next.js", "nuxt.js", "remix", "astro", "gatsby", "ember.js",
    "backbone.js", "jquery", "redux", "mobx", "zustand", "recoil", "tanstack query",
    "react query", "rxjs", "bootstrap", "tailwind css", "material ui", "chakra ui",
    "ant design", "styled components", "emotion", "webpack", "vite", "rollup",
    "esbuild", "parcel", "babel", "storybook", "three.js", "d3.js", "chart.js",
    "framer motion", "web components", "pwa", "webassembly", "wasm",
]

_BACKEND = [
    "node.js", "nodejs", "express", "express.js", "nestjs", "fastify", "koa",
    "django", "flask", "fastapi", "tornado", "pyramid", "spring", "spring boot",
    "spring mvc", "hibernate", "micronaut", "quarkus", "asp.net", "asp.net core",
    ".net", ".net core", "ruby on rails", "rails", "laravel", "symfony", "codeigniter",
    "phoenix", "gin", "echo", "fiber", "actix", "rocket", "ktor", "vert.x",
    "grpc", "graphql", "rest", "rest api", "soap", "websockets", "webhooks",
    "microservices", "serverless", "trpc", "openapi", "swagger",
]

_DATABASES = [
    "mysql", "postgresql", "mongodb", "redis", "elasticsearch", "opensearch",
    "cassandra", "dynamodb", "oracle", "sql server", "sqlite", "mariadb", "couchdb",
    "couchbase", "neo4j", "firebase", "firestore", "supabase", "cockroachdb",
    "influxdb", "timescaledb", "clickhouse", "snowflake", "bigquery", "redshift",
    "databricks", "presto", "trino", "hive", "hbase", "memcached", "rabbitmq",
    "kafka", "apache kafka", "pulsar", "nats", "activemq", "prisma", "drizzle",
    "sqlalchemy", "typeorm", "sequelize", "mongoose", "dbt",
]

_CLOUD_DEVOPS = [
    "aws", "amazon web services", "azure", "microsoft azure", "gcp", "google cloud",
    "google cloud platform", "docker", "kubernetes", "openshift", "helm", "terraform",
    "pulumi", "ansible", "chef", "puppet", "vagrant", "packer", "cloudformation",
    "jenkins", "gitlab ci", "github actions", "circleci", "travis ci", "argo cd",
    "argocd", "spinnaker", "tekton", "bamboo", "teamcity", "nginx", "apache",
    "haproxy", "envoy", "istio", "linkerd", "consul", "vault", "prometheus",
    "grafana", "datadog", "new relic", "splunk", "elk", "elk stack", "logstash",
    "kibana", "opentelemetry", "jaeger", "sentry", "pagerduty", "cloudflare",
    "cloudflare workers", "lambda", "aws lambda", "ec2", "s3", "rds", "ecs", "eks",
    "fargate", "cloudwatch", "sns", "sqs", "api gateway", "vpc", "iam", "ci/cd",
    "gitops", "infrastructure as code", "site reliability engineering", "sre",
]

_DATA_ML = [
    "machine learning", "deep learning", "artificial intelligence", "natural language processing",
    "computer vision", "reinforcement learning", "generative ai", "large language models",
    "llm", "llms", "rag", "prompt engineering", "mlops", "data science", "data analysis",
    "data analytics", "data engineering", "data warehousing", "etl", "elt",
    "business intelligence", "statistics", "predictive modeling", "feature engineering",
    "a/b testing", "tensorflow", "pytorch", "keras", "scikit-learn", "pandas", "numpy",
    "scipy", "matplotlib", "seaborn", "plotly", "jupyter", "spark", "apache spark",
    "pyspark", "hadoop", "airflow", "apache airflow", "dagster", "prefect", "kafka streams",
    "flink", "apache flink", "tableau", "power bi", "looker", "qlik", "dax",
    "hugging face", "transformers", "langchain", "llamaindex", "openai api",
    "pinecone", "weaviate", "chroma", "vector databases", "xgboost", "lightgbm",
    "opencv", "spacy", "nltk", "mlflow", "kubeflow", "sagemaker", "vertex ai",
]

_MOBILE = [
    "android", "ios", "flutter", "react native", "xamarin", "ionic", "swiftui",
    "uikit", "jetpack compose", "kotlin multiplatform", "cordova", "capacitor",
]

_TESTING_QA = [
    "unit testing", "integration testing", "end-to-end testing", "e2e testing",
    "test driven development", "tdd", "behavior driven development", "bdd",
    "jest", "vitest", "mocha", "chai", "jasmine", "cypress", "playwright",
    "selenium", "puppeteer", "pytest", "unittest", "junit", "testng", "rspec",
    "cucumber", "postman", "soapui", "jmeter", "k6", "locust", "load testing",
    "performance testing", "regression testing", "qa automation",
]

_TOOLS_PRACTICES = [
    "git", "github", "gitlab", "bitbucket", "svn", "mercurial", "linux", "unix",
    "windows server", "macos", "agile", "scrum", "kanban", "safe", "waterfall",
    "jira", "confluence", "trello", "asana", "notion", "slack", "figma", "sketch",
    "adobe xd", "miro", "lucidchart", "uml", "design patterns", "object oriented programming",
    "functional programming", "data structures", "algorithms", "system design",
    "distributed systems", "event-driven architecture", "domain driven design",
    "clean architecture", "api design", "code review", "pair programming",
    "oauth", "jwt", "saml", "openid connect", "sso", "rbac", "encryption",
    "penetration testing", "owasp", "soc 2", "gdpr", "hipaa", "pci dss",
]

_SOFT_SKILLS = [
    "leadership", "communication", "problem solving", "teamwork", "collaboration",
    "team collaboration", "project management", "stakeholder management",
    "analytical thinking", "critical thinking", "time management", "adaptability",
    "creativity", "attention to detail", "mentoring", "coaching", "presentation",
    "negotiation", "conflict resolution", "decision making", "strategic thinking",
    "customer focus", "cross-functional collaboration", "ownership", "self-motivated",
]


def _dedupe(*groups: List[str]) -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for group in groups:
        for item in group:
            key = item.lower().strip()
            if key and key not in seen:
                seen.add(key)
                out.append(key)
    return out


SKILLS_DATABASE: List[str] = _dedupe(
    _PROGRAMMING_LANGUAGES, _FRONTEND, _BACKEND, _DATABASES, _CLOUD_DEVOPS,
    _DATA_ML, _MOBILE, _TESTING_QA, _TOOLS_PRACTICES, _SOFT_SKILLS,
)


# Technologies = everything except the soft-skills group.
_SOFT_SET = {s.lower() for s in _SOFT_SKILLS}
TECH_SKILLS: Set[str] = {s for s in SKILLS_DATABASE if s not in _SOFT_SET}


# ---------------------------------------------------------------------------
# Aliases / common short forms -> canonical skill name (must exist above).
# ---------------------------------------------------------------------------

SKILL_ALIASES: Dict[str, str] = {
    "k8s": "kubernetes",
    "k8": "kubernetes",
    "postgres": "postgresql",
    "psql": "postgresql",
    "node": "node.js",
    "nodejs": "node.js",
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "golang": "go",
    "rxjs": "rxjs",
    "gcp": "google cloud",
    "aws": "aws",
    "ec2": "ec2",
    "tf": "terraform",
    "k8s cluster": "kubernetes",
    "reactjs": "react",
    "react.js": "react",
    "vuejs": "vue",
    "nextjs": "next.js",
    "nuxtjs": "nuxt.js",
    "expressjs": "express",
    "dotnet": ".net",
    ".net core": ".net core",
    "tailwind": "tailwind css",
    "mui": "material ui",
    "ml": "machine learning",
    "dl": "deep learning",
    "ai": "artificial intelligence",
    "nlp": "natural language processing",
    "cv": "computer vision",
    "llm": "large language models",
    "llms": "large language models",
    "ci/cd": "ci/cd",
    "cicd": "ci/cd",
    "gha": "github actions",
    "iac": "infrastructure as code",
    "pgsql": "postgresql",
    "mongo": "mongodb",
    "es": "elasticsearch",
    "rest apis": "rest api",
    "restful": "rest api",
    "restful api": "rest api",
    "restful apis": "rest api",
    "graphql api": "graphql",
    "tf-idf": "machine learning",
    "oop": "object oriented programming",
    "ddd": "domain driven design",
    "tdd": "test driven development",
    "bdd": "behavior driven development",
    "sklearn": "scikit-learn",
    "scikit learn": "scikit-learn",
    "spring-boot": "spring boot",
    "springboot": "spring boot",
    "ms sql": "sql server",
    "mssql": "sql server",
    "sqlserver": "sql server",
    "gitlab ci/cd": "gitlab ci",
    "obj-c": "objective-c",
    "c sharp": "c#",
    "csharp": "c#",
    "cplusplus": "c++",
    "cpp": "c++",
}
