.PHONY: setup lab check demo bench report play clean graph

setup:            ## install deps (numpy + pytest, that is all)
	uv sync

lab:              ## run YOUR labs — red until you implement the TODOs
	uv run pytest weeks

check:            ## run the reference solutions — should be all green
	SOLUTION=1 uv run pytest

demo:             ## train the toy model and sample from it (~35s first run)
	uv run python scripts/demo.py

bench:            ## KV cache: naive vs cached, plus real cache budgets
	uv run python -m weeks.w07_serving.bench

report:           ## the eval card for your model
	uv run python -m weeks.w08_evals.report

play:             ## open the explorables in the sibling decoder course (works offline, file://)
	open ../decoder-course/app/course.html

graph:            ## what each week depends on
	@printf '%s\n' \
	  'w1 prediction ──► w2 tokens' \
	  'w1 ──► w3 attention ──► w4 block ──► w5 decoding' \
	  'w4 ──► w6 post-training' \
	  'w4 + w5 ──► w7 serving' \
	  'w1 + w5 ──► w8 measurement' \
	  'all ──► capstone'

clean:
	rm -rf .cache .pytest_cache .mypy_cache
	find . -name __pycache__ -prune -exec rm -rf {} +
