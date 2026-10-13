import streamlit as st
from api_client import post_discussion, get_discussion

st.set_page_config(page_title="Research Collaboration", page_icon="🧑‍🔬", layout="wide")
st.title("🧑‍🔬 Research Collaboration")

PROJECTS = [
    "Persian Classical Poetry Translation Analysis",
    "German Romantic Poetry Machine Translation",
    "Polish Romantic Poetry (Mickiewicz-era) Translation Study",
    "Cross-Cultural Metaphor Preservation Study",
    "Low-Resource Poetic Translation Benchmark (fa-de-pl)",
]

project = st.selectbox("Active research project", PROJECTS)

messages, err = get_discussion(project)
if err:
    st.error(f"Research service unavailable: {err}")
    st.stop()

st.subheader(f"Discussion: {project}")
if messages:
    for m in messages:
        with st.chat_message("user"):
            st.markdown(f"**{m['user_id']}** · _{m['timestamp'][:19]}_")
            st.write(m["message"])
else:
    st.caption("No messages yet — start the discussion below.")

user_id = st.text_input("Your researcher ID", value=st.session_state.get("user_id", "researcher_01"))
message = st.chat_input("Write a message...")
if message:
    st.session_state["user_id"] = user_id
    _, post_err = post_discussion(project, user_id, message)
    if post_err:
        st.error(f"Could not post message: {post_err}")
    else:
        st.rerun()
