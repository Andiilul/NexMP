import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function HomeLayout(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <main className="flex h-screen min-h-0 overflow-hidden bg-[#101114] text-[#f4fff8]">
      <Sidebar onAddCollection={() => navigate('/home/collections/new')} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header key={location.pathname} />
        <section className="min-h-0 flex-1 overflow-y-auto px-8 py-10">
          <Outlet context={{ openCollectionDialog: () => navigate('/home/collections/new') }} />
        </section>
      </div>
    </main>
  )
}
