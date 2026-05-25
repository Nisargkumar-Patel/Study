from typing import Dict, List


def extract_keyword_strings(job_data: Dict) -> List[str]:
    """Return lowercase keyword strings from job_data.

    Tolerates both the nested ``{"keywords": {"keywords": [...]}}`` shape and a
    flat ``{"keywords": [...]}`` shape, and keyword entries that are either
    (word, score) tuples or JSON-decoded [word, score] lists (or plain strings).
    """
    keywords = job_data.get("keywords", [])
    if isinstance(keywords, dict):
        keywords = keywords.get("keywords", [])
    if not isinstance(keywords, list):
        return []

    result = []
    for item in keywords:
        if isinstance(item, (list, tuple)):
            if item:
                result.append(str(item[0]).lower())
        else:
            result.append(str(item).lower())
    return result
