import streamlit as st
from api_client import list_translations, save_rating

st.set_page_config(page_title="Human Evaluation", page_icon="📝", layout="wide")
st.title("📝 Human Evaluation")

translations, err = list_translations(limit=50)
if err:
    st.error(f"Could not load translations: {err}")
    st.stop()
if not translations:
    st.info("No translations yet. Go to the **Translation** page first.")
    st.stop()

default_id = st.session_state.get("last_translation_id")
options = {f"{t['id']}  ({t['source_lang']} → {t['target_lang']}, {t['model_version']})": t["id"]
           for t in translations}
default_label = next((k for k, v in options.items() if v == default_id), list(options.keys())[0])

label = st.selectbox("Translation to rate", list(options.keys()),
                      index=list(options.keys()).index(default_label))
translation_id = options[label]
selected = next(t for t in translations if t["id"] == translation_id)

col1, col2 = st.columns(2)
with col1:
    st.markdown("**Source**")
    st.write(selected["source_text"])
    st.markdown("**NLLB-200**")
    st.write(selected.get("nllb_translation") or "—")
with col2:
    st.markdown("**M2M-100**")
    st.write(selected.get("m2m_translation") or "—")
    st.caption(f"Model version: {selected.get('model_version')} ({selected.get('traffic_group')})")

st.divider()
with st.form("rating_form"):
    user_id = st.text_input("Your researcher ID", value=st.session_state.get("user_id", "researcher_01"))
    preference = st.radio("Which translation do you prefer?",
                           ["nllb", "m2m", "equal", "neither"], horizontal=True)
    fluency = st.slider("Fluency", 1, 5, 3)
    poetic = st.slider("Poetic preservation", 1, 5, 3)
    cultural = st.slider("Cultural accuracy", 1, 5, 3)
    comments = st.text_area("Comments", height=80)
    submitted = st.form_submit_button("Submit rating", type="primary")

    if submitted:
        st.session_state["user_id"] = user_id
        result, rate_err = save_rating({
            "translation_id": translation_id, "user_id": user_id,
            "model_preference": preference, "fluency_score": fluency,
            "poetic_preservation_score": poetic, "cultural_accuracy_score": cultural,
            "comments": comments,
        })
        if rate_err:
            st.error(f"Could not submit rating: {rate_err}")
        else:
            st.success("Rating submitted. Thank you!")
