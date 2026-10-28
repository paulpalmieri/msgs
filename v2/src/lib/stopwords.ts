// Common French and English function words plus chat filler, hidden from
// word rankings by default. Tokens arrive lower-cased with French elisions
// (l', d', j', qu'…) already stripped, so "j'ai" is "ai" and "c'est" is "est".
const FR = `
a ai aie aient aies ait as au aux avec avais avait avant avez avions avoir avons ayant b bah ben bon c ça ca car ce ceci cela celle celles celui cependant certes ces cet cette ceux chaque chez ci comme comment d dans de des deux depuis dois doit donc dont du e elle elles en encore entre es est et étaient étais était étant été être eu eux f fait faire fais fois font g h hein ici il ils j je jusqu jusque l la là le les leur leurs lui m ma mais me même mes moi mon n ne ni non nos notre nous o ok on ont ou où par parce pas peu peut peux plus pour pourquoi qu quand que quel quelle quelles quels qui quoi s sa sans se ses si sien soit son sont sous suis sur t ta te tes toi ton tous tout toute toutes très tu un une vers vos votre vous vu y à è ô ouais oui voilà
alors aussi autre autres bien déjà enfin genre juste mal moins quoi rien sera serai seras serait trop tant tellement vraiment va vais vas vont fait faut fais faisait avoir aura aurai auras aurait étais ete etre etait sinon puis apres après meme tres deja
y'a ah oh eh euh hum bah ouai nan sa ta tt pr pk ds jsp jsuis cest
`;
const EN = `
a about above after again against all am an and any are aren as at be because been before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves
yeah yes ok okay oh just like get got go going im dont u ur also really will one
`;

export const STOPWORDS: string[] = [...new Set(`${FR} ${EN}`.split(/\s+/).filter(Boolean))];
