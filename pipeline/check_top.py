import json

with open("../web/src/data/players.json") as f:
    data = json.load(f)

data.sort(key=lambda x: -x["projPoints"])
print(f"{'Name':25s} {'Pos':4s} {'Proj':>7s} {'ADP':>6s}")
print("-" * 46)
for p in data[:20]:
    adp = p.get("adp", "—")
    print(f"{p['name'][:25]:25s} {p['position']:4s} {p['projPoints']:7.1f} {str(adp):>6s}")

print("\nBy position - top 3 each:")
for pos in ["QB", "RB", "WR", "TE"]:
    print(f"\n{pos}:")
    top = [p for p in data if p["position"] == pos][:3]
    for p in top:
        print(f"  {p['name'][:25]:25s} proj={p['projPoints']:7.1f} adp={p.get('adp')}")
