import Link from 'next/link'
import { Flame, Shield, Coins, Trophy, Users, Zap, ArrowRight, Star, TrendingUp, Heart } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Flame className="w-7 h-7 text-primary" />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">FanDreams</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted hover:text-foreground transition-colors px-4 py-2">
              Entrar
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold bg-primary hover:bg-primary-light text-white px-5 py-2 rounded-sm transition-colors"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            Taxa de apenas 12% — 40% menos que a concorrencia
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight">
            Crie, compartilhe,{' '}
            <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              monetize
            </span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-muted max-w-2xl mx-auto">
            A plataforma mais inovadora para criadores de conteudo.
            Gamificacao, FanCoins, menor taxa do mercado e muito mais.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-secondary text-white font-bold px-8 py-4 rounded-md text-lg hover:opacity-90 transition-opacity shadow-xl shadow-primary/25"
            >
              Comecar agora <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/explore"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-border text-foreground font-semibold px-8 py-4 rounded-md text-lg hover:bg-surface transition-colors"
            >
              Explorar criadores
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            <div>
              <div className="text-3xl font-bold text-foreground">12%</div>
              <div className="text-sm text-muted">Taxa plataforma</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">88%</div>
              <div className="text-sm text-muted">Para o criador</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">PIX</div>
              <div className="text-sm text-muted">Saque instantaneo</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Por que os criadores escolhem o <span className="text-primary">FanDreams</span>?
          </h2>
          <p className="text-muted text-center mb-16 max-w-2xl mx-auto">
            Inovacoes que nenhum concorrente oferece
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: 'Menor taxa do mercado',
                desc: 'Apenas 12% de comissao vs. 20% dos concorrentes. Voce fica com 88% de tudo que ganha.',
                gradient: 'from-primary to-purple-600',
              },
              {
                icon: Coins,
                title: 'FanCoins',
                desc: 'Economia interna gamificada. Fas compram e enviam coins, presentes e desbloqueiam conteudo.',
                gradient: 'from-amber-500 to-orange-600',
              },
              {
                icon: Trophy,
                title: 'Gamificacao total',
                desc: 'Streaks, badges, leaderboards, missoes diarias. Engajamento que nenhum concorrente tem.',
                gradient: 'from-emerald-500 to-teal-600',
              },
              {
                icon: Users,
                title: 'Discovery inteligente',
                desc: 'Feed algoritmico "Para voce". Seus fas te encontram aqui, sem depender de redes sociais.',
                gradient: 'from-blue-500 to-cyan-600',
              },
              {
                icon: Zap,
                title: 'PIX instantaneo',
                desc: 'Receba seus ganhos na hora via PIX. Sem esperar dias como nos concorrentes.',
                gradient: 'from-secondary to-rose-600',
              },
              {
                icon: Star,
                title: 'AI para criadores',
                desc: 'Chatbot IA que responde fas no seu estilo 24/7. Analytics inteligentes e sugestoes.',
                gradient: 'from-violet-500 to-indigo-600',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group p-6 bg-surface border border-border rounded-md hover:border-primary/50 transition-all duration-300"
              >
                <div
                  className={`w-12 h-12 rounded-md bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-24 bg-surface border-t border-border/50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Compare e veja a diferenca</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted font-medium">Recurso</th>
                  <th className="py-3 px-4 text-center">
                    <span className="text-primary font-bold">FanDreams</span>
                  </th>
                  <th className="py-3 px-4 text-center text-muted">OnlyFans</th>
                  <th className="py-3 px-4 text-center text-muted">Fansly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ['Taxa', '12%', '20%', '20%'],
                  ['Discovery', 'Algoritmo IA', 'Nenhum', 'Basico'],
                  ['Gamificacao', 'Completa', 'Nenhuma', 'Nenhuma'],
                  ['FanCoins', 'Sim', 'Nao', 'Nao'],
                  ['Streaks', 'Sim', 'Nao', 'Nao'],
                  ['Fan Battles', 'Sim', 'Nao', 'Nao'],
                  ['PIX nativo', 'Sim', 'Parcial', 'Nao'],
                  ['AI Chatbot', 'Incluso', 'Terceiros', 'Nao'],
                ].map(([feature, fandreams, of, fansly]) => (
                  <tr key={feature}>
                    <td className="py-3 px-4 font-medium">{feature}</td>
                    <td className="py-3 px-4 text-center text-primary font-semibold">{fandreams}</td>
                    <td className="py-3 px-4 text-center text-muted">{of}</td>
                    <td className="py-3 px-4 text-center text-muted">{fansly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Pronto para ganhar mais com menos taxa?
          </h2>
          <p className="text-lg text-muted mb-8">
            Junte-se aos criadores que ja faturam mais no FanDreams.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-white font-bold px-8 py-4 rounded-md text-lg hover:opacity-90 transition-opacity shadow-xl shadow-primary/25"
          >
            Criar minha conta gratis <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-primary" />
              <span className="font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                FanDreams
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted">
              <Link href="#" className="hover:text-foreground transition-colors">
                Termos de uso
              </Link>
              <Link href="#" className="hover:text-foreground transition-colors">
                Privacidade
              </Link>
              <Link href="#" className="hover:text-foreground transition-colors">
                Contato
              </Link>
            </div>
            <p className="text-xs text-muted">2026 FanDreams. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
