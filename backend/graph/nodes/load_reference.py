import os


def load_reference_node(state: dict) -> dict:
    ref_path = os.path.join(os.path.dirname(__file__), "..", "..", "reference_script.md")
    try:
        with open(ref_path, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        content = ""

    return {
        "reference_script": content,
        "current_step": "load_reference",
    }
