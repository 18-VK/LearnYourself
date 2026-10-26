using EFCorePractice.Models;
using System;

namespace EFCorePractice
{
    class EFpractice
    {
        public static void Main(string[] args)
        {
            //CURD operation 
            using(var DBConext = new EFContext())
            {
                /*
                //Insert 
                Product? ObjProd = new Product() { Name ="Ryzen5", Description = "5Gen processor", Category = "Computer" };
                Product? ObjProd1 = new Product() { Name = "Ryzen7", Description = "7Gen processor", Category = "Computer" };
                DBConext.Products.Add(ObjProd);
                DBConext.Products.Add(ObjProd1);
                DBConext.SaveChanges();

                //Read 
                ObjProd = null;
                ObjProd = DBConext.Products.Select(P => P).Where(P => P.Name == "Ryzen5").FirstOrDefault();

                //Update 
                if (ObjProd != null)
                {

                    ObjProd.Name = "Intel I5";
                    DBConext.Update(ObjProd);
                    DBConext.SaveChanges();                }

                // delete 
                if (ObjProd != null)
                {

                    DBConext.Products.Remove(ObjProd);
                    DBConext.SaveChanges();
                }
                */

                // Practice 2 
                // One to many relation 
                /* 
                Blog ObjBlog = new Blog() { Title = "Test cricket" };
                ObjBlog.posts.Add(new Post { Title = "IndVsAus 2018/2019" });
                ObjBlog.posts.Add(new Post { Title = "IndVsAus 2020/2021" });

                DBConext.Blogs.Add(ObjBlog);
                DBConext.SaveChanges();
                */

                // try to delete.. 
                Blog ObjBlog = DBConext.Blogs.Find(1);
                if (ObjBlog != null)
                {
                    try
                    {
                        DBConext.Remove(ObjBlog);
                        DBConext.SaveChanges();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine(ex.InnerException.Message);
                    }
                    
                }
            }
        }
    }
}