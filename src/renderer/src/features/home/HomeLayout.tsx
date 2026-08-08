import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function HomeLayout(): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <main className="flex h-screen min-h-0 overflow-hidden bg-[#101114] text-[#f4fff8]">
      <Sidebar onAddCollection={() => navigate('/home/collections/new')} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <section className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full w-full justify-center p-8">
            <Outlet context={{ openCollectionDialog: () => navigate('/home/collections/new') }} />
          </div>
        </section>
      </div>
    </main>
  )
}
