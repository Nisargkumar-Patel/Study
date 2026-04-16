from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    app_name: str = "ATS Resume Builder API"
    debug: bool = True
    api_version: str = "v1"
    cors_origins: list = ["*"]  # In production, specify exact origins

    class Config:
        env_file = ".env"


settings = Settings()
