import streamlit as st
from api_client import translate, save_translation

st.set_page_config(page_title="Translation", page_icon="🌐", layout="wide")
st.title("🌐 Poetic Translation & Analysis")

LANGUAGES = ["persian", "german", "polish"]

col_a, col_b = st.columns(2)
with col_a:
    source_lang = st.selectbox("From", LANGUAGES, index=0)
with col_b:
    target_options = [l for l in LANGUAGES if l != source_lang]
    target_lang = st.selectbox("To", target_options, index=0)

text = st.text_area("Input text", height=150, placeholder="Paste a poem or line of poetry...")

compare = st.checkbox("Compare against M2M-100 baseline", value=True)
analyze = st.checkbox("Run poetic feature analysis (rhyme/meter/metaphor)", value=True)

if st.button("Translate & Analyze", type="primary", disabled=len(text.strip()) < 2):
    with st.spinner("Translating..."):
        result, err = translate(source_lang, target_lang, text, compare, analyze)

    if err:
        st.error(f"Translation failed: {err}")
    else:
        st.session_state["last_translation"] = result
        st.session_state["last_source_text"] = text
        st.session_state["last_source_lang"] = source_lang
        st.session_state["last_target_lang"] = target_lang

        st.success(f"Served by model version **{result['model_version']}** "
                    f"({result['traffic_group']} traffic) in {result['latency_ms']:.0f}ms")

        col1, col2 = st.columns(2)
        with col1:
            st.subheader("NLLB-200")
            st.write(result["nllb_translation"])
        with col2:
            st.subheader("M2M-100")
            st.write(result.get("m2m_translation") or "_(comparison not requested)_")

        if result.get("poetic_features"):
            st.subheader("Poetic Feature Analysis")
            st.json(result["poetic_features"])

        # Persist to the research DB so it's available in Evaluation/Analytics.
        saved, save_err = save_translation({
            "source_text": text, "source_lang": source_lang, "target_lang": target_lang,
            "nllb_translation": result["nllb_translation"],
            "m2m_translation": result.get("m2m_translation"),
            "model_version": result["model_version"], "traffic_group": result["traffic_group"],
            "poetic_features": result.get("poetic_features"),
        })
        if save_err:
            st.warning(f"Translation succeeded but could not be saved to research DB: {save_err}")
        else:
            st.session_state["last_translation_id"] = saved["id"]
            st.info(f"Saved as `{saved['id']}` — go to **Evaluation** to rate it.")
